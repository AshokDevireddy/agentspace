import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS, isLandlineError, isInvalidPhoneError, getPhoneValidationError } from '@/lib/telnyx';
import { logMessage } from '@/lib/sms-helpers';
import { incrementMessageCount } from '@/lib/sms-billing';

export type SmsMessageType =
  | 'welcome'
  | 'birthday'
  | 'lapse'
  | 'billing'
  | 'quarterly'
  | 'policy_packet'
  | 'holiday';

export interface AutoSendSettings {
  sms_auto_send_enabled: boolean;
  sms_welcome_require_approval: boolean;
  sms_birthday_require_approval: boolean;
  sms_lapse_require_approval: boolean;
  sms_billing_require_approval: boolean;
  sms_quarterly_require_approval: boolean;
  sms_policy_packet_require_approval: boolean;
  sms_holiday_require_approval: boolean;
}

const DEFAULT_AUTO_SEND_SETTINGS: AutoSendSettings = {
  sms_auto_send_enabled: true,
  sms_welcome_require_approval: false,
  sms_birthday_require_approval: false,
  sms_lapse_require_approval: false,
  sms_billing_require_approval: false,
  sms_quarterly_require_approval: false,
  sms_policy_packet_require_approval: false,
  sms_holiday_require_approval: false,
};

const MESSAGE_TYPE_TO_COLUMN: Record<SmsMessageType, keyof AutoSendSettings> = {
  welcome: 'sms_welcome_require_approval',
  birthday: 'sms_birthday_require_approval',
  lapse: 'sms_lapse_require_approval',
  billing: 'sms_billing_require_approval',
  quarterly: 'sms_quarterly_require_approval',
  policy_packet: 'sms_policy_packet_require_approval',
  holiday: 'sms_holiday_require_approval',
};

/**
 * Agent override (non-null) takes priority over agency master toggle.
 *   Agent explicitly OFF  → always draft
 *   Agent explicitly ON   → skip agency master toggle, check per-type overrides
 *   Agent NULL (default)  → use agency master toggle, then per-type overrides
 */
export function shouldAutoSend(
  settings: AutoSendSettings | null | undefined,
  messageType: SmsMessageType,
  agentAutoSendEnabled?: boolean | null
): boolean {
  if (agentAutoSendEnabled === false) return false;

  const effectiveSettings = settings || DEFAULT_AUTO_SEND_SETTINGS;

  if (agentAutoSendEnabled == null && !effectiveSettings.sms_auto_send_enabled) {
    return false;
  }

  const requireApprovalColumn = MESSAGE_TYPE_TO_COLUMN[messageType];
  return !(effectiveSettings[requireApprovalColumn] as boolean);
}

export function validatePlaceholders(messageText: string): {
  isValid: boolean;
  unresolvedPlaceholders: string[];
} {
  const matches = messageText.match(/\{\{([^}]+)\}\}/g);

  if (!matches || matches.length === 0) {
    return { isValid: true, unresolvedPlaceholders: [] };
  }

  return { isValid: false, unresolvedPlaceholders: matches };
}

export interface SendOrCreateDraftParams {
  conversationId: string;
  senderId: string;
  receiverId: string;
  messageText: string;
  agencyPhone: string;
  clientPhone: string;
  messageType: SmsMessageType;
  autoSendSettings: AutoSendSettings | null | undefined;
  agentAutoSendEnabled?: boolean | null;
  metadata?: Record<string, unknown>;
}

export interface SendOrCreateDraftResult {
  success: boolean;
  messageId: string;
  status: 'sent' | 'draft';
  error?: string;
}

/** Creates a draft message and returns a standardized result. */
async function createDraft(
  params: Omit<SendOrCreateDraftParams, 'agencyPhone' | 'clientPhone' | 'autoSendSettings'>,
): Promise<SendOrCreateDraftResult> {
  const { conversationId, senderId, receiverId, messageText, messageType, metadata = {} } = params;

  const message = await logMessage({
    conversationId,
    senderId,
    receiverId,
    body: messageText,
    direction: 'outbound',
    status: 'draft',
    metadata: { ...metadata, automated: true, type: messageType },
  });

  return { success: true, messageId: message.id, status: 'draft' };
}

/**
 * Sends an SMS immediately or creates a draft based on agency auto-send settings.
 * Falls back to draft on placeholder validation failure or Telnyx errors.
 */
export async function sendOrCreateDraft(
  params: SendOrCreateDraftParams
): Promise<SendOrCreateDraftResult> {
  const {
    agencyPhone,
    clientPhone,
    messageType,
    messageText,
    autoSendSettings,
    agentAutoSendEnabled,
    metadata = {},
    ...draftParams
  } = params;

  if (!shouldAutoSend(autoSendSettings, messageType, agentAutoSendEnabled)) {
    return createDraft({ ...draftParams, messageText, messageType, metadata });
  }

  const placeholderValidation = validatePlaceholders(messageText);
  if (!placeholderValidation.isValid) {
    console.log(`Unresolved placeholders, falling back to draft: ${placeholderValidation.unresolvedPlaceholders.join(', ')}`);
    return createDraft({ ...draftParams, messageText, messageType, metadata });
  }

  try {
    await sendSMS({ from: agencyPhone, to: clientPhone, text: messageText });

    // Tally the message against the agent's monthly billing count
    await incrementMessageCount(draftParams.senderId);

    const message = await logMessage({
      conversationId: draftParams.conversationId,
      senderId: draftParams.senderId,
      receiverId: draftParams.receiverId,
      body: messageText,
      direction: 'outbound',
      status: 'delivered',
      metadata: { ...metadata, automated: true, type: messageType },
    });

    return { success: true, messageId: message.id, status: 'sent' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Landline errors: log as failed, not draft — re-sending would just fail again
    if (isLandlineError(error)) {
      console.error(`Telnyx send failed (landline): ${errorMessage}`);
      const message = await logMessage({
        conversationId: draftParams.conversationId,
        senderId: draftParams.senderId,
        receiverId: draftParams.receiverId,
        body: messageText,
        direction: 'outbound',
        status: 'failed',
        metadata: { ...metadata, automated: true, type: messageType, error: 'Landline number cannot receive SMS', error_code: '40001' },
      });
      return { success: false, messageId: message.id, status: 'sent' as const, error: 'landline' };
    }

    // Invalid phone errors: log as failed, not draft — re-sending would just fail again
    if (isInvalidPhoneError(error)) {
      const phoneError = getPhoneValidationError(clientPhone) || `Phone number ${clientPhone} was rejected by the carrier as undeliverable.`;
      console.error(`Telnyx send failed (invalid phone ${clientPhone}): ${errorMessage}`);
      const message = await logMessage({
        conversationId: draftParams.conversationId,
        senderId: draftParams.senderId,
        receiverId: draftParams.receiverId,
        body: messageText,
        direction: 'outbound',
        status: 'failed',
        metadata: { ...metadata, automated: true, type: messageType, error: phoneError, error_code: '40310' },
      });
      return { success: false, messageId: message.id, status: 'sent' as const, error: 'invalid_phone' };
    }

    console.error(`Telnyx send failed, falling back to draft: ${errorMessage}`);

    const result = await createDraft({ ...draftParams, messageText, messageType, metadata });
    return { ...result, error: errorMessage };
  }
}

/** Batch fetches auto-send settings, deduplicating agency IDs. */
export async function batchFetchAutoSendSettings(
  agencyIds: string[]
): Promise<Map<string, AutoSendSettings>> {
  const uniqueAgencyIds = [...new Set(agencyIds)];

  if (uniqueAgencyIds.length === 0) {
    return new Map();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('agencies')
    .select(`
      id,
      sms_auto_send_enabled,
      sms_welcome_require_approval,
      sms_birthday_require_approval,
      sms_lapse_require_approval,
      sms_billing_require_approval,
      sms_quarterly_require_approval,
      sms_policy_packet_require_approval,
      sms_holiday_require_approval
    `)
    .in('id', uniqueAgencyIds);

  if (error) {
    console.error('Error fetching auto-send settings:', error);
    return new Map();
  }

  const settingsMap = new Map<string, AutoSendSettings>();

  for (const agency of data || []) {
    settingsMap.set(agency.id, {
      sms_auto_send_enabled: agency.sms_auto_send_enabled ?? true,
      sms_welcome_require_approval: agency.sms_welcome_require_approval ?? false,
      sms_birthday_require_approval: agency.sms_birthday_require_approval ?? false,
      sms_lapse_require_approval: agency.sms_lapse_require_approval ?? false,
      sms_billing_require_approval: agency.sms_billing_require_approval ?? false,
      sms_quarterly_require_approval: agency.sms_quarterly_require_approval ?? false,
      sms_policy_packet_require_approval: agency.sms_policy_packet_require_approval ?? false,
      sms_holiday_require_approval: agency.sms_holiday_require_approval ?? false,
    });
  }

  return settingsMap;
}

export async function fetchAutoSendSettings(
  agencyId: string
): Promise<AutoSendSettings | null> {
  const settingsMap = await batchFetchAutoSendSettings([agencyId]);
  return settingsMap.get(agencyId) || null;
}

/** Batch fetches per-agent auto-send override status. NULL means "follow agency default". */
export async function batchFetchAgentAutoSendStatus(
  agentIds: string[]
): Promise<Map<string, boolean | null>> {
  const uniqueIds = [...new Set(agentIds)];
  if (uniqueIds.length === 0) return new Map();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, sms_auto_send_enabled')
    .in('id', uniqueIds);

  if (error) {
    console.error('Error fetching agent auto-send status:', error);
    return new Map();
  }

  const map = new Map<string, boolean | null>();
  for (const agent of data || []) {
    map.set(agent.id, agent.sms_auto_send_enabled ?? null);
  }
  return map;
}
