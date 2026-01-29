/**
 * AI SMS Agent for Higher Tier Users
 * Provides automated responses to deal-specific questions via SMS
 */

import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS, normalizePhoneNumber } from '@/lib/telnyx';
import { logMessage, getDealWithDetails, type ConversationResult } from '@/lib/sms-helpers';
import { Anthropic } from '@anthropic-ai/sdk';

// Types
interface AIProcessingResult {
  success: boolean;
  action: 'responded' | 'escalated' | 'ignored';
  reason?: string;
  responseText?: string;
  processingTimeMs: number;
}

type QuestionType = 'deal_related' | 'non_deal';

// Helper functions for 3-layer filtering system

/**
 * Layer 1: Hard Block - Block unsafe/non-factual content using regex patterns
 * Returns true if message should be BLOCKED/ESCALATED
 */
function layer1HardBlock(messageText: string): boolean {
  const text = messageText.toLowerCase().trim();

  // Hard block patterns (return true = BLOCK/ESCALATE)
  const hardBlockPatterns = [
    // Claims and incidents
    /\b(claim|accident|damage|incident|injury|file a claim|report|emergency)\b/,

    // Policy changes and actions
    /\b(cancel|modify|change|update|add|remove|switch|transfer)\b.*\b(policy|coverage|beneficiary|payment)\b/,
    /\b(new policy|another policy|different policy|more coverage)\b/,

    // Advice and recommendations
    /\b(should i|recommend|advice|opinion|suggest|better|compare|shop around)\b/,

    // Legal and complaints
    /\b(lawyer|sue|complaint|dispute|refund|fraud|legal)\b/,

    // Action requests (I want/need)
    /\b(i want|i need|i would like|help me|tell me|please)\b.*\b(to|cancel|change|file|get|add)\b/,

    // How-to requests (procedural)
    /\bhow (do i|can i|to)\b/
  ];

  return hardBlockPatterns.some(pattern => pattern.test(text));
}

/**
 * Layer 2: Fact Question Shape Check - Only allow interrogative questions requesting information
 * Returns true if message has proper question shape and should PROCEED TO LAYER 3
 */
function layer2FactQuestionShape(messageText: string): boolean {
  const text = messageText.toLowerCase().trim();

  // Question starters - interrogative words that begin fact-seeking questions
  const interrogativeStarters = /^(what|when|where|who|which|how much|how many|is|are|do|does|can|will)\b/;
  const hasQuestionMark = text.includes('?');
  const hasInterrogativeWord = /\b(what|when|where|who|which|is|are|my|the)\b/.test(text);

  // Must be requesting information, not action
  // Allow: questions starting with interrogative words OR questions with ? and interrogative content
  const isInformationRequest = interrogativeStarters.test(text) ||
    (hasQuestionMark && hasInterrogativeWord);

  // Block statements disguised as questions
  const statementPatterns = [
    /\bi want to know\b/, // "I want to know..." = statement
    /\bcan you tell me how to\b/, // procedural request
    /\bwould like to\b/, // action request
    /\bi need to\b/, // action request
    /\bhelp me\b/ // action request
  ];

  const isStatement = statementPatterns.some(pattern => pattern.test(text));

  return isInformationRequest && !isStatement;
}

/**
 * Helper function to get nested property from object
 */
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Layer 3: Deal Entity Reference Check - Ensure question references actual deal data fields
 * Returns true if question references available data and should PROCEED
 */
function layer3DealEntityCheck(messageText: string, dealData: any): boolean {
  const text = messageText.toLowerCase().trim();

  // Map question patterns to deal data fields
  const entityMappings = [
    {
      patterns: [/policy number/, /policy #/, /policy.*number/],
      fields: ['policy_number'],
      required: true
    },
    {
      patterns: [/premium/, /payment/, /cost/, /how much/, /pay.*month/, /monthly/, /annual/],
      fields: ['monthly_premium', 'annual_premium'],
      required: true
    },
    {
      patterns: [/effective date/, /start date/, /when.*start/, /policy.*start/, /begin/, /effective/],
      fields: ['policy_effective_date'],
      required: true
    },
    {
      patterns: [/carrier/, /company/, /insurer/, /insurance company/, /policy with/, /who.*insur/, /which.*insurance/, /what.*insurance/],
      fields: ['carrier.name'],
      required: true
    },
    {
      // Product/coverage type questions
      patterns: [/product/, /type of (policy|insurance|coverage)/, /kind of (policy|insurance|coverage)/, /coverage type/, /what (insurance|coverage|policy) do i have/, /what do i have/],
      fields: ['carrier.name', 'policy_number'],
      required: true
    },
    {
      patterns: [/beneficiary/, /beneficiaries/, /who else.*on my policy/, /who.*on my policy/, /how many people/, /people on my policy/, /covered.*policy/],
      fields: ['beneficiary'], // Note: may not always be available
      required: false
    },
    {
      patterns: [/agent/, /who.*agent/, /my agent/],
      fields: ['agent.first_name', 'agent.last_name'],
      required: true
    },
    {
      // Agent contact info questions
      patterns: [/agent.*(email|contact|phone|number)/, /email.*(agent|address)/, /contact.*agent/],
      fields: ['agent.email', 'agent.phone_number'],
      required: false
    },
    {
      patterns: [/status/, /active/, /is.*active/, /policy.*active/, /still.*active/],
      fields: ['status', 'status_standardized'],
      required: true
    },
    {
      patterns: [/billing cycle/, /billing/, /how often/, /when.*pay/, /payment.*schedule/, /next payment/, /due date/],
      fields: ['billing_cycle'],
      required: false
    },
    {
      // General policy info questions - catch-all for "my policy" type questions
      patterns: [/my policy/, /my insurance/, /policy info/, /policy details/, /tell me about my/],
      fields: ['policy_number', 'carrier.name', 'status', 'monthly_premium'],
      required: false
    }
  ];

  // Check if question matches any entity pattern
  for (const mapping of entityMappings) {
    const matchesPattern = mapping.patterns.some(pattern => pattern.test(text));

    if (matchesPattern) {
      // Check if corresponding data exists
      const hasData = mapping.fields.some(field => {
        const value = getNestedProperty(dealData, field);
        return value !== null && value !== undefined && value !== '';
      });

      // If required field is missing, escalate
      if (mapping.required && !hasData) {
        return false; // ESCALATE
      }

      return true; // ALLOW
    }
  }

  return false; // No matching entity = ESCALATE
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

    // Get deal details for Layer 3 classification and AI response
    const dealDetails = await getDealWithDetails(deal.id);
    if (!dealDetails) {
      return {
        success: false,
        action: 'ignored',
        reason: 'Deal details not found',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Classify the message using 3-layer system
    const questionType = classifyMessage(messageText, dealDetails);

    if (questionType === 'non_deal') {
      // Flag the deal for agent attention - ALL non-deal messages escalated (no ignoring)
      await flagDealForMoreInfo(deal.id);
      return {
        success: true,
        action: 'escalated',
        reason: 'Message flagged for agent attention',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Deal-related question - continue with AI response

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
    const agencyPhoneNumber = agency.phone_number;
    if (!agencyPhoneNumber) {
      throw new Error('Agency phone number not configured');
    }

    const clientPhone = conversation.client_phone;
    if (!clientPhone) {
      throw new Error('Client phone number not available');
    }

    await sendSMS({
      from: agencyPhoneNumber,
      to: normalizePhoneNumber(clientPhone),
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
 * 3-Layer Classification System - Conservative approach that only allows factual questions about deal entities
 * Layer 1: Hard Block - Block unsafe/non-factual content
 * Layer 2: Fact Question Shape - Only allow proper interrogative questions
 * Layer 3: Deal Entity Reference - Ensure question references available deal data
 *
 * Returns: 'deal_related' (AI responds) OR 'non_deal' (escalate to agent)
 * PRINCIPLE: If AI doesn't respond, ALWAYS escalate to agent - never ignore messages
 */
export function classifyMessage(
  messageText: string,
  dealData?: any
): QuestionType {

  // Layer 1: Hard Block Check
  if (layer1HardBlock(messageText)) {
    return 'non_deal'; // ESCALATE
  }

  // Layer 2: Fact Question Shape Check
  if (!layer2FactQuestionShape(messageText)) {
    return 'non_deal'; // ESCALATE (not a proper question - agent should handle)
  }

  // Layer 3: Deal Entity Reference Check
  if (dealData && !layer3DealEntityCheck(messageText, dealData)) {
    return 'non_deal'; // ESCALATE (question about unavailable data)
  }

  // All layers passed - allow AI response
  return 'deal_related';
}

/**
 * Generate AI response using Claude
 */
async function generateAIResponse(
  messageText: string,
  dealDetails: any
): Promise<string> {
  const systemPrompt = `You are a policy information assistant. You ONLY answer questions about the specific policy details provided below. Keep responses under 320 characters for SMS.

STRICT RULES:
- ONLY answer direct questions about the policy information provided
- NEVER mention contacting an agent, representative, or any human - you ARE the assistant helping them
- NEVER say "contact your agent", "reach out to your agent", "speak with your agent", or similar phrases
- Be professional, friendly, and concise
- If information is not available, simply say it's not available in your records

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
    model: 'claude-haiku-4-5',
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
    return aiResponse.substring(0, 317) + '...';
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
