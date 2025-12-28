/**
 * SMS Agent Test Script
 *
 * Bypasses Telnyx webhooks to directly test the AI SMS agent responses.
 * Inserts messages into the database and triggers AI classification/response.
 * Does NOT send real SMS messages - only logs to database.
 *
 * Usage:
 *   npx tsx scripts/test-sms-agent.ts --message "What is my policy number?"
 *   npx tsx scripts/test-sms-agent.ts --message "Your policy is active" --direction outbound
 *   npx tsx scripts/test-sms-agent.ts --view
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Anthropic } from '@anthropic-ai/sdk';

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;

// Test configuration - update these IDs for your test case
const TEST_CONFIG = {
  conversationId: '3c41d1a0-208b-4095-8316-02ac268bd1c2',
  agentId: '606856ea-759f-4488-a3d0-f96eb42d6d71',
  dealId: 'fd825e7a-8b54-42a4-84de-5246c5a3c556',
  agencyId: '958b468d-56db-4783-be54-9d3feed37fa6',
  clientPhone: '6692456363',
};

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const anthropic = new Anthropic({ apiKey: anthropicApiKey });

// Parse command line arguments
function parseArgs(): { message?: string; direction: 'inbound' | 'outbound'; view: boolean } {
  const args = process.argv.slice(2);
  let message: string | undefined;
  let direction: 'inbound' | 'outbound' = 'inbound';
  let view = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--message' && args[i + 1]) {
      message = args[i + 1];
      i++;
    } else if (args[i] === '--direction' && args[i + 1]) {
      direction = args[i + 1] as 'inbound' | 'outbound';
      i++;
    } else if (args[i] === '--view') {
      view = true;
    }
  }

  return { message, direction, view };
}

// 3-Layer Classification System (copied from ai-sms-agent.ts)
function layer1HardBlock(messageText: string): boolean {
  const text = messageText.toLowerCase().trim();
  const hardBlockPatterns = [
    /\b(claim|accident|damage|incident|injury|file a claim|report|emergency)\b/,
    /\b(cancel|modify|change|update|add|remove|switch|transfer)\b.*\b(policy|coverage|beneficiary|payment)\b/,
    /\b(new policy|another policy|different policy|more coverage)\b/,
    /\b(should i|recommend|advice|opinion|suggest|better|compare|shop around)\b/,
    /\b(lawyer|sue|complaint|dispute|refund|fraud|legal)\b/,
    /\b(i want|i need|i would like|help me|tell me|please)\b.*\b(to|cancel|change|file|get|add)\b/,
    /\bhow (do i|can i|to)\b/
  ];
  return hardBlockPatterns.some(pattern => pattern.test(text));
}

function layer2FactQuestionShape(messageText: string): boolean {
  const text = messageText.toLowerCase().trim();
  const interrogativeStarters = /^(what|when|where|who|which|how much|how many|is|are|do|does|can|will)\b/;
  const hasQuestionMark = text.includes('?');
  const hasInterrogativeWord = /\b(what|when|where|who|which|is|are|my|the)\b/.test(text);
  const isInformationRequest = interrogativeStarters.test(text) || (hasQuestionMark && hasInterrogativeWord);
  const statementPatterns = [
    /\bi want to know\b/,
    /\bcan you tell me how to\b/,
    /\bwould like to\b/,
    /\bi need to\b/,
    /\bhelp me\b/
  ];
  const isStatement = statementPatterns.some(pattern => pattern.test(text));
  return isInformationRequest && !isStatement;
}

function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function layer3DealEntityCheck(messageText: string, dealData: any): boolean {
  const text = messageText.toLowerCase().trim();
  const entityMappings = [
    { patterns: [/policy number/, /policy #/, /policy.*number/], fields: ['policy_number'], required: true },
    { patterns: [/premium/, /payment/, /cost/, /how much/, /pay.*month/, /monthly/, /annual/], fields: ['monthly_premium', 'annual_premium'], required: true },
    { patterns: [/effective date/, /start date/, /when.*start/, /policy.*start/, /begin/, /effective/], fields: ['policy_effective_date'], required: true },
    { patterns: [/carrier/, /company/, /insurer/, /insurance company/, /policy with/, /who.*insur/, /which.*insurance/, /what.*insurance/], fields: ['carrier.name'], required: true },
    { patterns: [/product/, /type of (policy|insurance|coverage)/, /kind of (policy|insurance|coverage)/, /coverage type/, /what (insurance|coverage|policy) do i have/, /what do i have/], fields: ['carrier.name', 'policy_number'], required: true },
    { patterns: [/beneficiary/, /beneficiaries/, /who else.*on my policy/, /who.*on my policy/, /how many people/, /people on my policy/, /covered.*policy/], fields: ['beneficiary'], required: false },
    { patterns: [/agent/, /who.*agent/, /my agent/], fields: ['agent.first_name', 'agent.last_name'], required: true },
    { patterns: [/agent.*(email|contact|phone|number)/, /email.*(agent|address)/, /contact.*agent/], fields: ['agent.email', 'agent.phone_number'], required: false },
    { patterns: [/status/, /active/, /is.*active/, /policy.*active/, /still.*active/], fields: ['status', 'status_standardized'], required: true },
    { patterns: [/billing cycle/, /billing/, /how often/, /when.*pay/, /payment.*schedule/, /next payment/, /due date/], fields: ['billing_cycle'], required: false },
    { patterns: [/my policy/, /my insurance/, /policy info/, /policy details/, /tell me about my/], fields: ['policy_number', 'carrier.name', 'status', 'monthly_premium'], required: false }
  ];

  for (const mapping of entityMappings) {
    const matchesPattern = mapping.patterns.some(pattern => pattern.test(text));
    if (matchesPattern) {
      const hasData = mapping.fields.some(field => {
        const value = getNestedProperty(dealData, field);
        return value !== null && value !== undefined && value !== '';
      });
      if (mapping.required && !hasData) return false;
      return true;
    }
  }
  return false;
}

function classifyMessage(messageText: string, dealData?: any): 'deal_related' | 'non_deal' {
  if (layer1HardBlock(messageText)) return 'non_deal';
  if (!layer2FactQuestionShape(messageText)) return 'non_deal';
  if (dealData && !layer3DealEntityCheck(messageText, dealData)) return 'non_deal';
  return 'deal_related';
}

// Generate AI response
async function generateAIResponse(messageText: string, dealDetails: any): Promise<string> {
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

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Client question: "${messageText}"\n\nPlease provide a helpful response about their policy information. Keep it under 320 characters.` }]
  });

  const aiResponse = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return aiResponse.length > 320 ? aiResponse.substring(0, 317) + '...' : aiResponse;
}

// Log message to database
async function logMessage(params: {
  conversationId: string;
  senderId: string;
  receiverId: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      receiver_id: params.receiverId,
      body: params.body,
      direction: params.direction,
      message_type: 'sms',
      status: params.status || 'delivered',
      metadata: params.metadata || {},
      sent_at: now,
      read_at: params.direction === 'outbound' ? now : null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log message: ${error.message}`);

  // Update last_message_at in conversation
  await supabase
    .from('conversations')
    .update({ last_message_at: now })
    .eq('id', params.conversationId);

  return data;
}

// Fetch deal with details
async function getDealWithDetails(dealId: string) {
  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      agent:agent_id (id, first_name, last_name, phone_number, agency_id, subscription_tier),
      carrier:carrier_id (id, name)
    `)
    .eq('id', dealId)
    .single();

  if (error) throw new Error(`Failed to fetch deal: ${error.message}`);
  return deal;
}

// View recent messages
async function viewMessages() {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', TEST_CONFIG.conversationId)
    .order('sent_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Failed to fetch messages:', error.message);
    return;
  }

  console.log('\n=== Recent Messages ===\n');
  for (const msg of messages?.reverse() || []) {
    const direction = msg.direction === 'inbound' ? '<<< CLIENT' : '>>> AGENT';
    const automated = msg.metadata?.automated ? ' [AI]' : '';
    console.log(`${direction}${automated}: ${msg.body}`);
    console.log(`   Status: ${msg.status} | Sent: ${msg.sent_at}`);
    console.log('');
  }
}

// Main function
async function main() {
  const args = parseArgs();

  console.log('\n=== SMS Agent Test Script ===\n');
  console.log('Conversation ID:', TEST_CONFIG.conversationId);
  console.log('Agent ID:', TEST_CONFIG.agentId);
  console.log('Deal ID:', TEST_CONFIG.dealId);
  console.log('');

  if (args.view) {
    await viewMessages();
    return;
  }

  if (!args.message) {
    console.log('Usage:');
    console.log('  npx tsx scripts/test-sms-agent.ts --message "What is my policy number?"');
    console.log('  npx tsx scripts/test-sms-agent.ts --message "Hello" --direction outbound');
    console.log('  npx tsx scripts/test-sms-agent.ts --view');
    return;
  }

  try {
    // Fetch deal details
    console.log('Fetching deal details...');
    const dealDetails = await getDealWithDetails(TEST_CONFIG.dealId);
    console.log(`Deal: ${dealDetails.client_name} - ${dealDetails.carrier?.name || 'Unknown carrier'}`);
    console.log('');

    if (args.direction === 'outbound') {
      // Outbound message - just log it, no AI processing
      console.log('Logging outbound message (from agent)...');
      const message = await logMessage({
        conversationId: TEST_CONFIG.conversationId,
        senderId: TEST_CONFIG.agentId,
        receiverId: TEST_CONFIG.agentId,
        body: args.message,
        direction: 'outbound',
        status: 'sent',
        metadata: { test_script: true },
      });
      console.log('Message logged:', message.id);
      console.log('\nDone!');
      return;
    }

    // Inbound message - log it and trigger AI processing
    console.log('Logging inbound message (from client)...');
    const inboundMessage = await logMessage({
      conversationId: TEST_CONFIG.conversationId,
      senderId: TEST_CONFIG.agentId,
      receiverId: TEST_CONFIG.agentId,
      body: args.message,
      direction: 'inbound',
      status: 'received',
      metadata: { client_phone: TEST_CONFIG.clientPhone, test_script: true },
    });
    console.log('Inbound message logged:', inboundMessage.id);
    console.log('');

    // Classify the message
    console.log('Classifying message...');
    const classification = classifyMessage(args.message, dealDetails);
    console.log('Classification:', classification);
    console.log('');

    if (classification === 'non_deal') {
      console.log('Result: ESCALATED');
      console.log('Reason: Message does not pass AI classification filters');
      console.log('(In production, this would flag the deal for agent attention)');
      return;
    }

    // Generate AI response
    console.log('Generating AI response...');
    const startTime = Date.now();
    const aiResponse = await generateAIResponse(args.message, dealDetails);
    const processingTime = Date.now() - startTime;
    console.log(`AI Response (${processingTime}ms):`);
    console.log(`"${aiResponse}"`);
    console.log('');

    // Log the AI response (WITHOUT sending SMS)
    console.log('Logging AI response to database (NOT sending SMS)...');
    const responseMessage = await logMessage({
      conversationId: TEST_CONFIG.conversationId,
      senderId: TEST_CONFIG.agentId,
      receiverId: TEST_CONFIG.agentId,
      body: aiResponse,
      direction: 'outbound',
      status: 'sent',
      metadata: {
        automated: true,
        type: 'ai_response',
        client_phone: TEST_CONFIG.clientPhone,
        question_type: classification,
        processing_time_ms: processingTime,
        test_script: true,
        sms_skipped: true,
      },
    });
    console.log('AI response logged:', responseMessage.id);
    console.log('');
    console.log('Result: RESPONDED (logged to database, SMS not sent)');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
