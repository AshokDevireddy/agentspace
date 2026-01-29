/**
 * SMS Helper Functions
 * Business logic for SMS conversations and message handling
 *
 * Fully migrated to use Django API endpoints.
 * For server-side operations without access tokens, functions use CRON_SECRET
 * for server-to-server authentication.
 */

import { normalizePhoneForStorage } from '@/lib/telnyx';
import { replaceSmsPlaceholders, DEFAULT_SMS_TEMPLATES } from '@/lib/sms-template-helpers';
import { getApiBaseUrl } from './api-config';

// CRON_SECRET for server-to-server authentication
const CRON_SECRET = process.env.CRON_SECRET || '';

export interface ConversationResult {
  id: string;
  agent_id: string;
  agentId?: string;
  deal_id: string;
  dealId?: string;
  agency_id: string;
  agencyId?: string;
  type?: string;
  last_message_at?: string;
  lastMessageAt?: string;
  is_active?: boolean;
  isActive?: boolean;
  created_at?: string;
  createdAt?: string;
  client_phone?: string;
  phoneNumber?: string;
  sms_opt_in_status?: string;
  smsOptInStatus?: string;
  opted_in_at?: string;
  opted_out_at?: string;
}

interface MessageResult {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  sender_id?: string;
  senderId?: string;
  receiver_id?: string;
  receiverId?: string;
  body?: string;
  content?: string;
  direction: string;
  message_type?: string;
  messageType?: string;
  sent_at?: string;
  sentAt?: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface DealAgent {
  id: string;
  agency_id: string;
  agencyId?: string;
  phone_number?: string;
  phoneNumber?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
}

export interface DealResult {
  id: string;
  client_name?: string;
  clientName?: string;
  client_phone?: string;
  clientPhone?: string;
  client_email?: string;
  clientEmail?: string;
  agent?: DealAgent;
  agent_id?: string;
  agentId?: string;
}

/**
 * Internal helper to call Django API from server-side code
 *
 * If accessToken is provided, uses JWT authentication.
 * Otherwise, uses CRON_SECRET for server-to-server authentication.
 */
async function djangoApi<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: unknown
    accessToken?: string
  } = {}
): Promise<T> {
  const { method = 'GET', body, accessToken } = options
  const apiUrl = getApiBaseUrl()
  const url = `${apiUrl}${endpoint}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  } else if (CRON_SECRET) {
    // Use CRON_SECRET for server-to-server authentication
    headers['X-Cron-Secret'] = CRON_SECRET
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || `API call failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Gets an existing conversation without creating one
 * Returns null if conversation doesn't exist
 * Used by cron jobs that should only send to existing conversations
 *
 * Uses Django API endpoint: GET /api/sms/conversations/find
 */
export async function getConversationIfExists(
  agentId: string,
  dealId: string,
  agencyId: string,
  clientPhone?: string,
  accessToken?: string
): Promise<ConversationResult | null> {
  const params = new URLSearchParams()
  params.append('agent_id', agentId)
  params.append('deal_id', dealId)
  if (clientPhone) {
    params.append('phone', normalizePhoneForStorage(clientPhone))
  }

  const result = await djangoApi<{
    found: boolean
    conversation: ConversationResult | null
  }>(`/api/sms/conversations/find?${params.toString()}`, {
    method: 'GET',
    accessToken,
  })

  if (result.found && result.conversation) {
    const conv = result.conversation
    return {
      id: conv.id,
      agent_id: (conv.agentId || conv.agent_id) as string,
      deal_id: (conv.dealId || conv.deal_id) as string,
      agency_id: (conv.agencyId || conv.agency_id) as string,
      type: 'sms',
      last_message_at: conv.lastMessageAt || conv.last_message_at,
      is_active: true,
      created_at: conv.createdAt || conv.created_at,
      client_phone: conv.phoneNumber || conv.client_phone,
      sms_opt_in_status: conv.smsOptInStatus || conv.sms_opt_in_status,
      opted_in_at: conv.opted_in_at,
      opted_out_at: conv.opted_out_at,
    }
  }
  return null
}

/**
 * Gets or creates a conversation for an agent-client pair
 * Uses Django API endpoint: POST /api/sms/conversations/get-or-create
 */
export async function getOrCreateConversation(
  agentId: string,
  dealId: string,
  agencyId: string,
  clientPhone?: string,
  accessToken?: string
): Promise<ConversationResult> {
  const result = await djangoApi<{
    success: boolean
    conversation: ConversationResult
    created: boolean
  }>('/api/sms/conversations/get-or-create', {
    method: 'POST',
    body: {
      agent_id: agentId,
      deal_id: dealId,
      phone_number: clientPhone,
    },
    accessToken,
  })

  if (!result.success || !result.conversation) {
    throw new Error('Failed to get or create conversation')
  }

  // Normalize response to match expected interface
  const conv = result.conversation
  return {
    id: conv.id,
    agent_id: (conv.agentId || conv.agent_id) as string,
    deal_id: (conv.dealId || conv.deal_id) as string,
    agency_id: (conv.agencyId || conv.agency_id) as string,
    type: 'sms',
    last_message_at: conv.lastMessageAt || conv.last_message_at,
    is_active: true,
    created_at: conv.createdAt || conv.created_at,
    client_phone: conv.phoneNumber || conv.client_phone,
    sms_opt_in_status: conv.smsOptInStatus || conv.sms_opt_in_status,
  }
}

/**
 * Logs a message in the database
 * Uses Django API endpoint: POST /api/sms/messages/log
 */
export async function logMessage(
  params: {
    conversationId: string;
    senderId: string;
    receiverId: string;
    body: string;
    direction: 'inbound' | 'outbound';
    status?: string;
    metadata?: Record<string, unknown>;
  },
  accessToken?: string
): Promise<MessageResult> {
  const result = await djangoApi<{
    success: boolean
    message_id: string
    error?: string
  }>('/api/sms/messages/log', {
    method: 'POST',
    body: {
      conversation_id: params.conversationId,
      content: params.body,
      direction: params.direction,
      status: params.status || 'delivered',
      metadata: params.metadata,
    },
    accessToken,
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to log message')
  }

  return {
    id: result.message_id,
    conversation_id: params.conversationId,
    content: params.body,
    direction: params.direction,
    status: params.status || 'delivered',
    metadata: params.metadata,
  }
}

/**
 * Gets deal information including agent and client details
 * Uses Django API endpoint: GET /api/deals/{id}
 */
export async function getDealWithDetails(dealId: string, accessToken?: string): Promise<DealResult> {
  const result = await djangoApi<DealResult>(
    `/api/deals/${dealId}`,
    {
      method: 'GET',
      accessToken,
    }
  )

  return result
}

/**
 * Finds a deal by client phone number within a specific agency
 * Uses Django API endpoint: GET /api/deals/by-phone
 */
export async function findDealByClientPhone(
  clientPhone: string,
  agencyId: string,
  accessToken?: string
): Promise<DealResult | null> {
  const params = new URLSearchParams()
  params.append('phone', clientPhone)
  params.append('agency_id', agencyId)

  const result = await djangoApi<{
    found: boolean
    deal: DealResult | null
  }>(`/api/deals/by-phone?${params.toString()}`, {
    method: 'GET',
    accessToken,
  })

  if (result.found && result.deal) {
    return result.deal
  }
  return null
}

/**
 * Gets agency phone number
 * Uses Django API endpoint: GET /api/agencies/{id}/phone
 */
export async function getAgencyPhoneNumber(
  agencyId: string,
  accessToken?: string
): Promise<string | null> {
  const result = await djangoApi<{
    phone_number: string | null
  }>(`/api/agencies/${agencyId}/phone`, {
    method: 'GET',
    accessToken,
  })

  return result.phone_number
}

/**
 * Finds agency by phone number
 * Uses Django API endpoint: GET /api/agencies/by-phone
 */
export async function findAgencyByPhoneNumber(
  phoneNumber: string,
  accessToken?: string
): Promise<{ id: string; name: string; phone_number: string } | null> {
  const params = new URLSearchParams()
  params.append('phone', phoneNumber)

  const result = await djangoApi<{
    found: boolean
    agency: { id: string; name: string; phone_number: string } | null
  }>(`/api/agencies/by-phone?${params.toString()}`, {
    method: 'GET',
    accessToken,
  })

  if (result.found && result.agency) {
    return result.agency
  }
  return null
}

/**
 * Gets agency details (name and phone number)
 * Uses Django API endpoint: GET /api/agencies/{id}
 */
export async function getAgencyDetails(
  agencyId: string,
  accessToken?: string
): Promise<{ name: string; phone_number: string } | null> {
  const result = await djangoApi<{
    id: string
    name: string
    display_name: string
    phone_number: string | null
  }>(`/api/agencies/${agencyId}`, {
    method: 'GET',
    accessToken,
  })

  if (result.name && result.phone_number) {
    return {
      name: result.display_name || result.name,
      phone_number: result.phone_number,
    }
  }
  return null
}

/**
 * Sends the initial welcome message to a client
 * Uses Django API endpoints for all data
 */
export async function sendWelcomeMessage(
  clientPhone: string,
  agencyId: string,
  agentId: string,
  conversationId: string,
  clientName?: string,
  clientEmail?: string,
  agentName?: string,
  dealId?: string,
  accessToken?: string
): Promise<void> {
  const agency = await getAgencyDetails(agencyId, accessToken);

  if (!agency) {
    throw new Error('Agency not found or missing phone number');
  }

  // If client name or agent name not provided, try to fetch from deal
  let finalClientName = clientName;
  let finalClientEmail = clientEmail;
  let finalAgentName = agentName;

  if (dealId && (!finalClientName || !finalClientEmail || !finalAgentName)) {
    try {
      const deal = await getDealWithDetails(dealId, accessToken) as {
        clientName?: string;
        client_name?: string;
        clientEmail?: string;
        client_email?: string;
        agent?: {
          firstName?: string;
          first_name?: string;
          lastName?: string;
          last_name?: string;
        };
      };

      if (deal) {
        finalClientName = finalClientName || deal.clientName || deal.client_name;
        finalClientEmail = finalClientEmail || deal.clientEmail || deal.client_email;

        if (deal.agent && !finalAgentName) {
          const firstName = deal.agent.firstName || deal.agent.first_name || '';
          const lastName = deal.agent.lastName || deal.agent.last_name || '';
          finalAgentName = `${firstName} ${lastName}`.trim();
        }
      }
    } catch (error) {
      console.error('Failed to fetch deal details for welcome message:', error);
    }
  }

  // Fetch agency settings to check if welcome SMS is enabled
  try {
    const agencySettings = await djangoApi<{
      sms_welcome_enabled?: boolean;
      sms_welcome_template?: string;
    }>(`/api/agencies/${agencyId}/settings`, {
      method: 'GET',
      accessToken,
    });

    // Check if welcome SMS is enabled for this agency
    if (agencySettings?.sms_welcome_enabled === false) {
      return;
    }

    const clientFirstName = finalClientName?.split(' ')[0] || 'there';
    const displayEmail = finalClientEmail || 'your email';
    const displayAgentName = finalAgentName || 'your agent';

    // Use agency template or default
    const template = agencySettings?.sms_welcome_template || DEFAULT_SMS_TEMPLATES.welcome;
    const welcomeMessage = replaceSmsPlaceholders(template, {
      client_first_name: clientFirstName,
      agency_name: agency.name,
      agent_name: displayAgentName,
      client_email: displayEmail,
    });

    // Create draft message (don't send via Telnyx yet)
    await logMessage(
      {
        conversationId,
        senderId: agentId,
        receiverId: agentId, // Placeholder
        body: welcomeMessage,
        direction: 'outbound',
        status: 'draft', // Create as draft instead of sending
        metadata: {
          automated: true,
          type: 'welcome_message',
          client_phone: normalizePhoneForStorage(clientPhone),
        },
      },
      accessToken
    );
  } catch (error) {
    console.error('Failed to send welcome message:', error);
    throw error;
  }
}

/**
 * Updates conversation opt status (opted_in, opted_out)
 * Uses Django API endpoint: PUT /api/sms/opt-out
 */
export async function updateConversationOptStatus(
  conversationId: string,
  status: 'opted_in' | 'opted_out',
  accessToken?: string
): Promise<{ success: boolean }> {
  const result = await djangoApi<{
    id: string
    sms_opt_in_status: string
    opted_in_at?: string
    opted_out_at?: string
  }>('/api/sms/opt-out', {
    method: 'PUT',
    body: {
      conversation_id: conversationId,
      status: status,
    },
    accessToken,
  })

  return { success: !!result.id }
}

/**
 * Gets agent details by ID
 * Uses Django API endpoint: GET /api/agents/{id}
 */
export async function getAgentDetails(
  agentId: string,
  accessToken?: string
): Promise<{
  id: string
  first_name: string
  last_name: string
  phone_number?: string
  agency_id: string
  subscription_tier?: string
} | null> {
  try {
    const result = await djangoApi<{
      id: string
      firstName?: string
      first_name?: string
      lastName?: string
      last_name?: string
      phoneNumber?: string
      phone_number?: string
      agencyId?: string
      agency_id?: string
      subscriptionTier?: string
      subscription_tier?: string
    }>(`/api/agents/${agentId}`, {
      method: 'GET',
      accessToken,
    })

    return {
      id: result.id,
      first_name: result.firstName || result.first_name || '',
      last_name: result.lastName || result.last_name || '',
      phone_number: result.phoneNumber || result.phone_number,
      agency_id: result.agencyId || result.agency_id || '',
      subscription_tier: result.subscriptionTier || result.subscription_tier,
    }
  } catch (error) {
    console.error('Failed to get agent details:', error)
    return null
  }
}
