/**
 * SMS Helper Functions
 * Business logic for SMS conversations and message handling
 */

import { createAdminClient } from '@/lib/supabase/server';
import { normalizePhoneForStorage } from '@/lib/telnyx';

interface ConversationResult {
  id: string;
  agent_id: string;
  deal_id: string;
  agency_id: string;
  type: string;
  last_message_at: string;
  is_active: boolean;
  created_at: string;
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

  // If client phone is provided, try to find existing conversation by phone
  if (normalizedPhone) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .eq('client_phone', normalizedPhone)
      .eq('type', 'sms')
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      // Update the deal_id if it's different (client might have multiple deals)
      if (existing.deal_id !== dealId) {
        await supabase
          .from('conversations')
          .update({ deal_id: dealId })
          .eq('id', existing.id);
      }
      return existing as ConversationResult;
    }
  } else {
    // Fallback: Try to find existing conversation by deal
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .eq('deal_id', dealId)
      .eq('type', 'sms')
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return existing as ConversationResult;
    }
  }

  // Create new conversation with normalized phone
  const { data: newConversation, error } = await supabase
    .from('conversations')
    .insert({
      agent_id: agentId,
      deal_id: dealId,
      agency_id: agencyId,
      type: 'sms',
      is_active: true,
      client_phone: normalizedPhone,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
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
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log message: ${error.message}`);
  }

  // Update last_message_at in conversation
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
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

  // Find deal where client phone matches (compare normalized versions)
  const matchingDeal = deals?.find(deal => {
    const dealPhone = (deal.client_phone || '').replace(/\D/g, '');
    return dealPhone.includes(normalizedSearch) || normalizedSearch.includes(dealPhone);
  });

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

