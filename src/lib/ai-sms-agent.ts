/**
 * AI SMS Agent for Higher Tier Users
 * Provides automated responses to deal-specific questions via SMS
 */

import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS, normalizePhoneNumber } from '@/lib/telnyx';
import { logMessage, getDealWithDetails } from '@/lib/sms-helpers';
import { Anthropic } from '@anthropic-ai/sdk';

// Types
interface AIProcessingResult {
  success: boolean;
  action: 'responded' | 'escalated' | 'ignored';
  reason?: string;
  responseText?: string;
  processingTimeMs: number;
}

type QuestionType = 'deal_related' | 'non_deal' | 'not_question';

interface ConversationResult {
  id: string;
  agent_id: string;
  deal_id: string;
  agency_id: string;
  sms_opt_in_status: string;
  client_phone: string;
}

interface Agent {
  id: string;
  subscription_tier: string;
  agency_id: string;
  phone_number?: string;
  first_name: string;
  last_name: string;
}

interface Agency {
  id: string;
  messaging_enabled: boolean;
  name: string;
  phone_number: string;
}

interface Deal {
  id: string;
  client_name: string;
  client_phone: string;
  agent_id: string;
  agency_id: string;
  status_standardized: string;
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Main function to process AI messages in SMS webhook
 */
export async function processAIMessage(
  conversation: ConversationResult,
  messageText: string,
  agent: Agent,
  deal: Deal
): Promise<AIProcessingResult> {
  const startTime = Date.now();

  try {
    // Check if AI processing should be activated
    const agency = await getAgencyDetails(agent.agency_id);
    if (!agency) {
      return {
        success: false,
        action: 'ignored',
        reason: 'Agency not found',
        processingTimeMs: Date.now() - startTime
      };
    }

    const shouldProcess = await shouldProcessWithAI(agency, agent, conversation);
    if (!shouldProcess) {
      return {
        success: true,
        action: 'ignored',
        reason: 'AI processing conditions not met',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Classify the message
    const questionType = classifyMessage(messageText);

    if (questionType === 'not_question') {
      return {
        success: true,
        action: 'ignored',
        reason: 'Not a question',
        processingTimeMs: Date.now() - startTime
      };
    }

    if (questionType === 'non_deal') {
      // Flag the deal for agent attention
      await flagDealForMoreInfo(deal.id);
      return {
        success: true,
        action: 'escalated',
        reason: 'Non-deal question flagged for agent',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Deal-related question - generate AI response
    const dealDetails = await getDealWithDetails(deal.id);
    if (!dealDetails) {
      return {
        success: false,
        action: 'ignored',
        reason: 'Deal details not found',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Check SMS usage limits (AI responses count as SMS messages)
    const canSendSMS = await checkSMSUsageLimits(agent);
    if (!canSendSMS) {
      return {
        success: false,
        action: 'ignored',
        reason: 'SMS message limit exceeded',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Generate AI response
    const aiResponse = await generateAIResponse(messageText, dealDetails);

    // Send the response via SMS
    await sendSMS({
      from: agency.phone_number,
      to: normalizePhoneNumber(conversation.client_phone),
      text: aiResponse,
    });

    // Log the AI response as an outbound message
    await logMessage({
      conversationId: conversation.id,
      senderId: agent.id,
      receiverId: agent.id,
      body: aiResponse,
      direction: 'outbound',
      status: 'sent',
      metadata: {
        automated: true,
        type: 'ai_response',
        client_phone: conversation.client_phone,
        question_type: questionType,
        processing_time_ms: Date.now() - startTime,
      },
    });

    // Update SMS message count (AI responses count as SMS messages)
    await updateSMSUsageCount(agent.id);

    return {
      success: true,
      action: 'responded',
      responseText: aiResponse,
      processingTimeMs: Date.now() - startTime
    };

  } catch (error) {
    console.error('AI processing error:', error);
    return {
      success: false,
      action: 'ignored',
      reason: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Check if AI processing should be activated
 */
export async function shouldProcessWithAI(
  agency: Agency,
  agent: Agent,
  conversation: ConversationResult
): Promise<boolean> {
  // Check agency-wide messaging enabled
  if (!agency.messaging_enabled) {
    return false;
  }

  // Check agent subscription tier (Pro or Expert only)
  if (!['pro', 'expert'].includes(agent.subscription_tier)) {
    return false;
  }

  // Check opt-in status
  if (conversation.sms_opt_in_status !== 'opted_in') {
    return false;
  }

  return true;
}

/**
 * Classify message type with conservative approach
 */
export function classifyMessage(messageText: string): QuestionType {
  const text = messageText.toLowerCase().trim();

  // Question indicators
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'can', 'will', 'is', 'are', 'do', 'does'];
  const hasQuestionWord = questionWords.some(word => text.includes(word));
  const hasQuestionMark = text.includes('?');

  // If it's not likely a question, return early
  if (!hasQuestionWord && !hasQuestionMark && !text.includes('tell me') && !text.includes('i need')) {
    return 'not_question';
  }

  // Deal-specific keywords (high confidence)
  const dealKeywords = [
    'policy', 'premium', 'payment', 'due', 'effective date', 'carrier',
    'agent', 'coverage', 'beneficiary', 'policy number', 'billing cycle',
    'monthly', 'annual', 'status', 'active', 'when does', 'how much'
  ];

  // Non-deal keywords (escalation triggers)
  const nonDealKeywords = [
    'claim', 'accident', 'damage', 'cancel', 'modify', 'change',
    'new policy', 'should i', 'what insurance', 'how do i',
    'advice', 'recommend', 'better', 'lawyer', 'sue', 'complaint'
  ];

  // Check for non-deal indicators first
  const hasNonDealKeywords = nonDealKeywords.some(keyword => text.includes(keyword));
  if (hasNonDealKeywords) {
    return 'non_deal';
  }

  // Check for deal-specific keywords
  const hasDealKeywords = dealKeywords.some(keyword => text.includes(keyword));
  if (hasDealKeywords && (hasQuestionWord || hasQuestionMark)) {
    return 'deal_related';
  }

  // Conservative approach - if unclear, escalate to agent
  return 'non_deal';
}

/**
 * Generate AI response using Claude
 */
async function generateAIResponse(
  messageText: string,
  dealDetails: any
): Promise<string> {
  const systemPrompt = `You are a professional insurance assistant helping clients with questions about their specific policy. You can ONLY answer questions about the policy information provided. Keep responses under 320 characters for SMS.

STRICT RULES:
- Only answer questions about the specific policy data provided
- Do not provide general insurance advice
- Do not discuss other policies or companies
- If asked about changes, claims, or general advice, respond: "Please contact your agent for assistance with that request."
- Be professional and helpful
- Always include: "For policy changes or complex questions, contact your agent directly."

Policy Information:
- Client: ${dealDetails.client_name}
- Policy Number: ${dealDetails.policy_number || 'Not available'}
- Carrier: ${dealDetails.carrier?.name || 'Not specified'}
- Agent: ${dealDetails.agent?.first_name} ${dealDetails.agent?.last_name}
- Monthly Premium: $${dealDetails.monthly_premium || 'Not specified'}
- Annual Premium: $${dealDetails.annual_premium || 'Not specified'}
- Effective Date: ${dealDetails.policy_effective_date || 'Not specified'}
- Billing Cycle: ${dealDetails.billing_cycle || 'Not specified'}
- Status: ${dealDetails.status || dealDetails.status_standardized || 'Active'}`;

  const userPrompt = `Client question: "${messageText}"

Please provide a helpful response about their policy information. Keep it under 320 characters.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt
      }
    ]
  });

  const aiResponse = response.content[0]?.type === 'text' ? response.content[0].text : '';

  // Ensure response is SMS-friendly length
  if (aiResponse.length > 320) {
    return aiResponse.substring(0, 310) + '...' + '\n\nContact your agent for more details.';
  }

  return aiResponse;
}

/**
 * Get agency details
 */
async function getAgencyDetails(agencyId: string): Promise<Agency | null> {
  const supabase = createAdminClient();

  const { data: agency } = await supabase
    .from('agencies')
    .select('id, messaging_enabled, name, phone_number')
    .eq('id', agencyId)
    .single();

  return agency;
}

/**
 * Flag deal for more information
 */
async function flagDealForMoreInfo(dealId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('deals')
    .update({
      status_standardized: 'needs_more_info_notified',
      updated_at: new Date().toISOString()
    })
    .eq('id', dealId);
}

/**
 * Check SMS usage limits for billing (not AI limits)
 * AI responses count as SMS messages, not AI requests
 */
async function checkSMSUsageLimits(agent: Agent): Promise<boolean> {
  // Get current SMS usage from database
  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('messages_sent_count, subscription_tier, billing_cycle_end')
    .eq('id', agent.id)
    .single();

  if (error || !user) {
    console.error('Failed to fetch user SMS usage:', error);
    return false;
  }

  // Check if billing cycle has reset
  const now = new Date();
  const billingCycleEnd = user.billing_cycle_end ? new Date(user.billing_cycle_end) : null;

  if (billingCycleEnd && now > billingCycleEnd) {
    // Billing cycle has ended, usage should be reset
    // This will be handled by the SMS sending system
  }

  // SMS tier limits (from subscription-tiers.ts pattern)
  const tierLimits = {
    'free': 0,
    'basic': 50,
    'pro': 200,
    'expert': 1000
  };

  const limit = tierLimits[user.subscription_tier as keyof typeof tierLimits] || 0;
  const currentUsage = user.messages_sent_count || 0;

  // Pro and Expert tiers allow overage with billing, others are hard limits
  if (['pro', 'expert'].includes(user.subscription_tier)) {
    return true; // Allow overage with billing
  }

  return currentUsage < limit;
}

/**
 * Update SMS message count and handle billing
 * AI responses count as SMS messages, not AI requests
 */
async function updateSMSUsageCount(agentId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get current SMS count and subscription info
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('messages_sent_count, subscription_tier, stripe_subscription_id, billing_cycle_end')
    .eq('id', agentId)
    .single();

  if (fetchError || !user) {
    console.error('Failed to fetch user for SMS billing:', fetchError);
    return;
  }

  // Check if billing cycle needs reset
  const now = new Date();
  const billingCycleEnd = user.billing_cycle_end ? new Date(user.billing_cycle_end) : null;
  let currentCount = user.messages_sent_count || 0;

  if (billingCycleEnd && now > billingCycleEnd) {
    // Reset count for new billing cycle
    currentCount = 0;
    console.log(`Resetting SMS count for new billing cycle for user ${agentId}`);
  }

  const newCount = currentCount + 1;

  // Update the SMS count
  const { error: updateError } = await supabase
    .from('users')
    .update({ messages_sent_count: newCount })
    .eq('id', agentId);

  if (updateError) {
    console.error('Failed to update SMS messages count:', updateError);
    return;
  }

  // Handle overage billing for Pro and Expert tiers
  if (['pro', 'expert'].includes(user.subscription_tier) && user.stripe_subscription_id) {
    const tierLimits = {
      'pro': 200,
      'expert': 1000
    };

    const limit = tierLimits[user.subscription_tier as keyof typeof tierLimits];

    if (newCount > limit) {
      // Report SMS overage to Stripe
      try {
        const { reportMessageUsage } = await import('@/lib/stripe-usage');

        // Get the correct metered price ID for the tier
        const priceIds = {
          'pro': process.env.STRIPE_PRO_METERED_MESSAGES_PRICE_ID!,
          'expert': process.env.STRIPE_EXPERT_METERED_MESSAGES_PRICE_ID!
        };

        const priceId = priceIds[user.subscription_tier as keyof typeof priceIds];
        await reportMessageUsage(user.stripe_subscription_id, priceId, 1);

        console.log(`Reported SMS overage for ${user.subscription_tier} user ${agentId}: ${newCount - limit} messages over limit`);
      } catch (billingError) {
        console.error('Failed to report SMS overage billing:', billingError);
      }
    }
  }
}
