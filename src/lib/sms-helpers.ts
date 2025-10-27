/**
 * SMS Helper Functions
 * Business logic for SMS conversations and message handling
 */

import { createAdminClient } from '@/lib/supabase/server';
import { normalizePhoneForStorage, sendSMS } from '@/lib/telnyx';

interface ConversationResult {
  id: string;
  agent_id: string;
  deal_id: string;
  agency_id: string;
  type: string;
  last_message_at: string;
  is_active: boolean;
  created_at: string;
  client_phone?: string;
  sms_opt_in_status?: string;
  opted_in_at?: string;
  opted_out_at?: string;
}

interface MessageResult {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  direction: string;
  message_type: string;
  sent_at: string;
  status: string;
  metadata: any;
}

/**
 * Gets or creates a conversation for an agent-client pair
 * Uses client phone number to prevent duplicate conversations
 */
export async function getOrCreateConversation(
  agentId: string,
  dealId: string,
  agencyId: string,
  clientPhone?: string
): Promise<ConversationResult> {
  const supabase = createAdminClient();

  // Normalize phone number for consistent lookups (remove +1 prefix)
  const normalizedPhone = clientPhone ? normalizePhoneForStorage(clientPhone) : null;

  // First, check if conversation exists for this specific agent-deal pair (matches unique constraint)
  const { data: existingByDeal } = await supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', agentId)
    .eq('deal_id', dealId)
    .eq('type', 'sms')
    .eq('is_active', true)
    .maybeSingle();

  if (existingByDeal) {
    return existingByDeal as ConversationResult;
  }

  // If not found by deal, check if conversation exists for this phone number
  // (to handle case where client has multiple deals but we want one conversation)
  if (normalizedPhone) {
    const { data: existingByPhone } = await supabase
      .from('conversations')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('client_phone', normalizedPhone)
      .eq('type', 'sms')
      .eq('is_active', true)
      .maybeSingle();

    if (existingByPhone) {
      return existingByPhone as ConversationResult;
    }
  }

  // Create new conversation with normalized phone
  // Auto-opt-in for informational messages (billing, birthday reminders, etc.)
  const { data: newConversation, error } = await supabase
    .from('conversations')
    .insert({
      agent_id: agentId,
      deal_id: dealId,
      agency_id: agencyId,
      type: 'sms',
      is_active: true,
      client_phone: normalizedPhone,
      sms_opt_in_status: 'opted_in', // Auto-opt-in for informational messages
      opted_in_at: new Date().toISOString(), // Set opt-in timestamp
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  // Send welcome message when conversation is created
  if (normalizedPhone) {
    try {
      await sendWelcomeMessage(
        normalizedPhone,
        agencyId,
        agentId,
        newConversation.id
      );
      console.log(`Sent welcome message to ${normalizedPhone}`);
    } catch (error) {
      console.error('Failed to send welcome message:', error);
      // Don't throw - conversation was created successfully
    }
  }

  return newConversation as ConversationResult;
}

/**
 * Logs a message in the database
 */
export async function logMessage(params: {
  conversationId: string;
  senderId: string;
  receiverId: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status?: string;
  metadata?: any;
}): Promise<MessageResult> {
  const supabase = createAdminClient();

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
      // Automatically mark outbound messages as read (agent already knows what they sent)
      read_at: params.direction === 'outbound' ? now : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log message: ${error.message}`);
  }

  // Update last_message_at in conversation
  await supabase
    .from('conversations')
    .update({ last_message_at: now })
    .eq('id', params.conversationId);

  return data as MessageResult;
}

/**
 * Gets deal information including agent and client details
 */
export async function getDealWithDetails(dealId: string) {
  const supabase = createAdminClient();

  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      agent:agent_id (
        id,
        first_name,
        last_name,
        phone_number,
        agency_id
      )
    `)
    .eq('id', dealId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch deal: ${error.message}`);
  }

  return deal;
}

/**
 * Finds a deal by client phone number
 */
export async function findDealByClientPhone(clientPhone: string) {
  const supabase = createAdminClient();

  // Normalize phone number for comparison (remove all non-digits)
  const normalizedSearch = clientPhone.replace(/\D/g, '');

  console.log('🔍 Searching for deal with phone:', normalizedSearch);

  const { data: deals, error } = await supabase
    .from('deals')
    .select(`
      *,
      agent:agent_id (
        id,
        first_name,
        last_name,
        phone_number,
        agency_id
      )
    `)
    .not('client_phone', 'is', null);

  if (error) {
    throw new Error(`Failed to search deals: ${error.message}`);
  }

  console.log(`📊 Found ${deals?.length || 0} deals with phone numbers to check`);

  // Find deal where client phone matches (exact match on normalized versions)
  const matchingDeal = deals?.find(deal => {
    const dealPhone = (deal.client_phone || '').replace(/\D/g, '');
    const matches = dealPhone === normalizedSearch;

    if (matches) {
      console.log(`✅ Match found: ${deal.client_name} (${deal.client_phone})`);
    }

    return matches;
  });

  if (!matchingDeal) {
    console.log('❌ No matching deal found');
    if (deals && deals.length > 0) {
      console.log('📋 Available phones in database:', deals.map(d => d.client_phone).filter(Boolean).join(', '));
    }
  }

  return matchingDeal || null;
}

/**
 * Gets agency phone number
 */
export async function getAgencyPhoneNumber(agencyId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('agencies')
    .select('phone_number')
    .eq('id', agencyId)
    .single();

  if (error || !data?.phone_number) {
    return null;
  }

  return data.phone_number;
}

/**
 * Gets agency details (name and phone number)
 */
export async function getAgencyDetails(agencyId: string): Promise<{ name: string; phone_number: string } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('agencies')
    .select('name, phone_number')
    .eq('id', agencyId)
    .single();

  if (error || !data?.phone_number || !data?.name) {
    return null;
  }

  return data;
}

/**
 * Sends the initial welcome message to a client
 */
export async function sendWelcomeMessage(
  clientPhone: string,
  agencyId: string,
  agentId: string,
  conversationId: string
): Promise<void> {
  const agency = await getAgencyDetails(agencyId);

  if (!agency) {
    throw new Error('Agency not found or missing phone number');
  }

  const welcomeMessage = `Thanks for your policy with ${agency.name}. You'll receive policy updates and reminders by text. Message frequency may vary. Msg&data rates may apply. Reply STOP to opt out. Reply HELP for help.`;

  // Send SMS via Telnyx
  await sendSMS({
    from: agency.phone_number,
    to: clientPhone,
    text: welcomeMessage,
  });

  // Log the message
  await logMessage({
    conversationId,
    senderId: agentId,
    receiverId: agentId, // Placeholder
    body: welcomeMessage,
    direction: 'outbound',
    status: 'sent',
    metadata: {
      automated: true,
      type: 'welcome_message',
      client_phone: normalizePhoneForStorage(clientPhone),
    },
  });
}

