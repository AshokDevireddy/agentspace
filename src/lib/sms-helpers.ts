/**
 * SMS Helper Functions
 * Business logic for SMS conversations and message handling
 */

import { createAdminClient } from '@/lib/supabase/server';
import { normalizePhoneForStorage, sendSMS, formatPhoneForDisplay } from '@/lib/telnyx';
import { replaceSmsPlaceholders, DEFAULT_SMS_TEMPLATES, formatBeneficiaries, formatAgentName } from '@/lib/sms-template-helpers';
import { sendOrCreateDraft, fetchAutoSendSettings, batchFetchAgentAutoSendStatus } from '@/lib/sms-auto-send';

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
  metadata: Record<string, unknown>;
}

/**
 * Gets an existing conversation without creating one
 * Returns null if conversation doesn't exist
 * Used by cron jobs that should only send to existing conversations
 */
export async function getConversationIfExists(
  agentId: string,
  dealId: string,
  agencyId: string,
  clientPhone?: string
): Promise<ConversationResult | null> {
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

  // Return null instead of creating a new conversation
  return null;
}

/**
 * Gets or creates a conversation for an agent-client pair
 * Uses client phone number to prevent duplicate conversations
 * Updates the phone number if it has changed on the deal
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
    // If conversation exists but phone number has changed, update it
    if (normalizedPhone && existingByDeal.client_phone !== normalizedPhone) {
      console.log(`📞 Updating phone number for conversation ${existingByDeal.id}: ${existingByDeal.client_phone} → ${normalizedPhone}`);

      const { data: updated, error: updateError } = await supabase
        .from('conversations')
        .update({ client_phone: normalizedPhone })
        .eq('id', existingByDeal.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update conversation phone number:', updateError);
        // Return existing conversation even if update failed
        return existingByDeal as ConversationResult;
      }

      return updated as ConversationResult;
    }

    return existingByDeal as ConversationResult;
  }

  // NOTE: We do NOT reuse conversations by phone number
  // Each deal gets its own conversation, even if the phone number matches another deal
  // Phone number uniqueness is enforced at the deal level in the API

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
  metadata?: Record<string, unknown>;
}): Promise<MessageResult> {
  const supabase = createAdminClient();

  const now = new Date().toISOString();
  const isDraft = params.status === 'draft';

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
      // Draft messages should have null sent_at until approved
      sent_at: isDraft ? null : now,
      // Automatically mark outbound messages as read (agent already knows what they sent)
      // But don't mark drafts as read yet
      read_at: params.direction === 'outbound' && !isDraft ? now : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log message: ${error.message}`);
  }

  // Update last_message_at in conversation (only for non-draft messages)
  if (!isDraft) {
    await supabase
      .from('conversations')
      .update({ last_message_at: now })
      .eq('id', params.conversationId);
  }

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
 * Finds a deal by client phone number within a specific agency
 * Uses database-level filtering to handle large datasets efficiently
 */
export async function findDealByClientPhone(clientPhone: string, agencyId: string) {
  const supabase = createAdminClient();

  // Normalize phone number for comparison (remove all non-digits)
  const normalizedSearch = clientPhone.replace(/\D/g, '');

  console.log('🔍 Searching for deal with phone:', normalizedSearch, 'in agency:', agencyId);

  // Try multiple phone format variations to match against database
  const phoneVariations = [
    normalizedSearch,                    // e.g., "6692456363"
    `+1${normalizedSearch}`,             // e.g., "+16692456363"
    `1${normalizedSearch}`,              // e.g., "16692456363"
    `(${normalizedSearch.slice(0, 3)}) ${normalizedSearch.slice(3, 6)}-${normalizedSearch.slice(6)}`, // e.g., "(669) 245-6363"
    `${normalizedSearch.slice(0, 3)}-${normalizedSearch.slice(3, 6)}-${normalizedSearch.slice(6)}`, // e.g., "669-245-6363"
  ];

  // Try to find deal with exact match on any variation within the agency
  for (const variation of phoneVariations) {
    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        agent:agent_id!inner (
          id,
          first_name,
          last_name,
          phone_number,
          agency_id
        )
      `)
      .eq('client_phone', variation)
      .eq('agent.agency_id', agencyId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`Error searching with variation ${variation}:`, error);
      continue;
    }

    if (deal) {
      console.log(`✅ Match found with variation "${variation}": ${deal.client_name} (${deal.client_phone}) in agency ${agencyId}`);
      return deal;
    }
  }

  // If no exact match found, try pattern matching using ilike
  // This searches for the phone number anywhere in the client_phone field
  console.log('🔄 No exact match, trying pattern matching...');

  const { data: deals, error: patternError } = await supabase
    .from('deals')
    .select(`
      *,
      agent:agent_id!inner (
        id,
        first_name,
        last_name,
        phone_number,
        agency_id
      )
    `)
    .ilike('client_phone', `%${normalizedSearch}%`)
    .eq('agent.agency_id', agencyId)
    .limit(10); // Get up to 10 potential matches

  if (patternError) {
    console.error('Pattern matching error:', patternError);
    throw new Error(`Failed to search deals: ${patternError.message}`);
  }

  if (deals && deals.length > 0) {
    console.log(`📊 Found ${deals.length} potential matches with pattern matching in agency ${agencyId}`);

    // Find the best match by normalizing and comparing
    const matchingDeal = deals.find(deal => {
      const dealPhone = (deal.client_phone || '').replace(/\D/g, '');
      const matches = dealPhone === normalizedSearch;

      if (matches) {
        console.log(`✅ Best match found: ${deal.client_name} (${deal.client_phone}) in agency ${agencyId}`);
      }

      return matches;
    });

    if (matchingDeal) {
      return matchingDeal;
    }
  }

  console.log('❌ No matching deal found for phone:', normalizedSearch, 'in agency:', agencyId);
  return null;
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
 * Finds agency by phone number
 */
export async function findAgencyByPhoneNumber(phoneNumber: string): Promise<{ id: string; name: string; phone_number: string } | null> {
  const supabase = createAdminClient();

  // Normalize phone number for comparison
  const normalizedPhone = normalizePhoneForStorage(phoneNumber);

  // Try multiple variations
  const phoneVariations = [
    phoneNumber,           // Original format
    normalizedPhone,       // Without +1
    `+1${normalizedPhone}`, // With +1
  ];

  for (const variation of phoneVariations) {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name, phone_number')
      .eq('phone_number', variation)
      .maybeSingle();

    if (error) {
      console.error(`Error searching agency with phone ${variation}:`, error);
      continue;
    }

    if (data) {
      console.log(`✅ Found agency: ${data.name} (${data.phone_number})`);
      return data;
    }
  }

  console.log('❌ No agency found for phone number:', phoneNumber);
  return null;
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
  conversationId: string,
  clientName?: string,
  clientEmail?: string,
  agentName?: string
): Promise<void> {
  const supabase = createAdminClient();
  const agency = await getAgencyDetails(agencyId);

  if (!agency) {
    throw new Error('Agency not found or missing phone number');
  }

  // Get conversation to find deal
  const { data: conversation } = await supabase
    .from('conversations')
    .select('deal_id')
    .eq('id', conversationId)
    .single();

  // Fetch deal data for template variables
  let dealData: {
    client_name?: string;
    client_email?: string;
    insured?: string;
    policy_number?: string;
    face_amount?: string;
    monthly_premium?: string;
    initial_draft?: string;
    carrier_name?: string;
    beneficiaries?: string;
  } = {};

  if (conversation?.deal_id) {
    const { data: deal } = await supabase
      .from('deals')
      .select('client_name, client_email, monthly_premium, policy_effective_date, face_value, policy_number, carrier_id, agent_id')
      .eq('id', conversation.deal_id)
      .single();

    if (deal) {
      dealData.client_name = deal.client_name;
      dealData.client_email = deal.client_email;
      dealData.insured = deal.client_name || '';
      dealData.policy_number = deal.policy_number || '';
      dealData.face_amount = deal.face_value ? `$${deal.face_value.toLocaleString()}` : '';
      dealData.monthly_premium = deal.monthly_premium ? `$${deal.monthly_premium.toFixed(2)}` : '';
      dealData.initial_draft = deal.policy_effective_date || '';

      // Fetch carrier name
      if (deal.carrier_id) {
        const { data: carrier } = await supabase
          .from('carriers')
          .select('name')
          .eq('id', deal.carrier_id)
          .single();
        dealData.carrier_name = carrier?.name || '';
      }

      // Fetch beneficiaries
      const { data: beneficiaries } = await supabase
        .from('beneficiaries')
        .select('first_name, last_name')
        .eq('deal_id', conversation.deal_id);
      dealData.beneficiaries = formatBeneficiaries(beneficiaries);
    }
  }

  // If client name or agent name not provided, use deal data
  let finalClientName = clientName || dealData.client_name;
  let finalClientEmail = clientEmail || dealData.client_email;
  let finalAgentName = agentName;

  let finalAgentPhone = '';
  if (!finalAgentName) {
    const { data: agent } = await supabase
      .from('users')
      .select('first_name, last_name, phone_number')
      .eq('id', agentId)
      .single();

    if (agent) {
      finalAgentName = formatAgentName(agent.first_name, agent.last_name);
      finalAgentPhone = agent.phone_number || '';
    }
  } else {
    // Format agent name if it was provided
    const nameParts = finalAgentName.split(' ');
    if (nameParts.length >= 2) {
      finalAgentName = formatAgentName(nameParts[0], nameParts.slice(1).join(' '));
    }
    // Still need to fetch phone number
    const { data: agent } = await supabase
      .from('users')
      .select('phone_number')
      .eq('id', agentId)
      .single();
    finalAgentPhone = agent?.phone_number || '';
  }

  // Fetch agency SMS template settings including master switch
  const { data: agencySettings } = await supabase
    .from('agencies')
    .select('messaging_enabled, sms_welcome_enabled, sms_welcome_template')
    .eq('id', agencyId)
    .single();

  // Check master switch first
  if (agencySettings?.messaging_enabled === false) {
    console.log('⏭️ Welcome message skipped: messaging disabled for agency');
    return;
  }

  const clientFirstName = finalClientName?.split(' ')[0] || 'there';
  const displayEmail = finalClientEmail || 'your email';
  const displayAgentName = finalAgentName || 'your agent';

  // Choose template based on sms_welcome_enabled
  // If enabled: use custom template or default
  // If disabled: use default template
  const template = agencySettings?.sms_welcome_enabled
    ? (agencySettings?.sms_welcome_template || DEFAULT_SMS_TEMPLATES.welcome)
    : DEFAULT_SMS_TEMPLATES.welcome;
  const welcomeMessage = replaceSmsPlaceholders(template, {
    client_first_name: clientFirstName,
    agency_name: agency.name,
    agent_name: displayAgentName,
    agent_phone: formatPhoneForDisplay(finalAgentPhone),
    client_email: displayEmail,
    insured: dealData.insured || '',
    policy_number: dealData.policy_number || '',
    face_amount: dealData.face_amount || '',
    monthly_premium: dealData.monthly_premium || '',
    initial_draft: dealData.initial_draft || '',
    carrier_name: dealData.carrier_name || '',
    beneficiaries: dealData.beneficiaries || '',
  });

  // Use auto-send logic to either send immediately or create draft
  const autoSendSettings = await fetchAutoSendSettings(agencyId);
  const agentAutoSendMap = await batchFetchAgentAutoSendStatus([agentId]);

  const result = await sendOrCreateDraft({
    conversationId,
    senderId: agentId,
    receiverId: agentId,
    messageText: welcomeMessage,
    agencyPhone: agency.phone_number,
    clientPhone,
    messageType: 'welcome',
    autoSendSettings,
    agentAutoSendEnabled: agentAutoSendMap.get(agentId) ?? null,
    metadata: {
      client_phone: normalizePhoneForStorage(clientPhone),
    },
  });

  console.log(`✅ Welcome message ${result.status === 'sent' ? 'sent' : 'created as draft'}`);
}

