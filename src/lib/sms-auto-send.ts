import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/telnyx';
import { logMessage } from '@/lib/sms-helpers';

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
 * Master OFF → false (all drafts)
 * Master ON + per-type override OFF → true (auto-send)
 * Master ON + per-type override ON → false (requires approval)
 */
export function shouldAutoSend(
  settings: AutoSendSettings | null | undefined,
  messageType: SmsMessageType
): boolean {
  const effectiveSettings = settings || DEFAULT_AUTO_SEND_SETTINGS;

  if (!effectiveSettings.sms_auto_send_enabled) {
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
    metadata = {},
    ...draftParams
  } = params;

  if (!shouldAutoSend(autoSendSettings, messageType)) {
    return createDraft({ ...draftParams, messageText, messageType, metadata });
  }

  const placeholderValidation = validatePlaceholders(messageText);
  if (!placeholderValidation.isValid) {
    console.log(`Unresolved placeholders, falling back to draft: ${placeholderValidation.unresolvedPlaceholders.join(', ')}`);
    return createDraft({ ...draftParams, messageText, messageType, metadata });
  }

  try {
    await sendSMS({ from: agencyPhone, to: clientPhone, text: messageText });

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
