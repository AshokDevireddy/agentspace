/**
 * SMS Auto-Send Helper Functions
 * Handles logic for determining whether to auto-send SMS or create drafts
 */

import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/telnyx';
import { logMessage } from '@/lib/sms-helpers';

// Valid message types that can be auto-sent
export type SmsMessageType =
  | 'welcome'
  | 'birthday'
  | 'lapse'
  | 'billing'
  | 'quarterly'
  | 'policy_packet'
  | 'holiday';

// Auto-send settings for an agency
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

// Default settings when agency doesn't have settings configured
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

/**
 * Maps message type to the corresponding require_approval column
 */
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
 * Determines whether a message should be auto-sent based on agency settings
 *
 * Logic:
 * - If master toggle (sms_auto_send_enabled) is OFF → return false (all messages are drafts)
 * - If master toggle is ON and per-type override is OFF → return true (auto-send)
 * - If master toggle is ON and per-type override is ON → return false (requires approval)
 */
export function shouldAutoSend(
  settings: AutoSendSettings | null | undefined,
  messageType: SmsMessageType
): boolean {
  // Use defaults if no settings provided
  const effectiveSettings = settings || DEFAULT_AUTO_SEND_SETTINGS;

  // Master toggle OFF → all messages become drafts
  if (!effectiveSettings.sms_auto_send_enabled) {
    return false;
  }

  // Master toggle ON → check per-type override
  const requireApprovalColumn = MESSAGE_TYPE_TO_COLUMN[messageType];
  const requiresApproval = effectiveSettings[requireApprovalColumn] as boolean;

  // If requires approval is TRUE, don't auto-send (return false)
  // If requires approval is FALSE, auto-send (return true)
  return !requiresApproval;
}

/**
 * Validates that a message doesn't contain unresolved placeholders
 * Returns true if message is valid (no unresolved placeholders)
 * Returns false if message has issues (unresolved {{placeholder}} patterns)
 */
export function validatePlaceholders(messageText: string): {
  isValid: boolean;
  unresolvedPlaceholders: string[];
} {
  // Match {{placeholder}} patterns that weren't replaced
  const placeholderPattern = /\{\{([^}]+)\}\}/g;
  const matches = messageText.match(placeholderPattern);

  if (!matches || matches.length === 0) {
    return { isValid: true, unresolvedPlaceholders: [] };
  }

  return { isValid: false, unresolvedPlaceholders: matches };
}

/**
 * Parameters for sendOrCreateDraft
 */
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

/**
 * Result of sendOrCreateDraft operation
 */
export interface SendOrCreateDraftResult {
  success: boolean;
  messageId: string;
  status: 'sent' | 'draft';
  reason?: 'auto_send' | 'requires_approval' | 'master_disabled' | 'placeholder_validation_failed' | 'send_failed';
  error?: string;
}

/**
 * Main orchestrator function that either sends an SMS immediately or creates a draft
 *
 * Decision flow:
 * 1. Check auto-send settings
 * 2. If should auto-send, validate placeholders
 * 3. If placeholders valid, send via Telnyx
 * 4. If send fails or placeholders invalid, fall back to draft
 * 5. Otherwise create as draft
 */
export async function sendOrCreateDraft(
  params: SendOrCreateDraftParams
): Promise<SendOrCreateDraftResult> {
  const {
    conversationId,
    senderId,
    receiverId,
    messageText,
    agencyPhone,
    clientPhone,
    messageType,
    autoSendSettings,
    metadata = {},
  } = params;

  // Check if we should auto-send
  const shouldSend = shouldAutoSend(autoSendSettings, messageType);

  if (!shouldSend) {
    // Create as draft - determine reason
    const reason = !autoSendSettings?.sms_auto_send_enabled
      ? 'master_disabled'
      : 'requires_approval';

    console.log(`📝 Creating draft (${reason}): auto-send settings prevent immediate send`);

    const message = await logMessage({
      conversationId,
      senderId,
      receiverId,
      body: messageText,
      direction: 'outbound',
      status: 'draft',
      metadata: { ...metadata, automated: true, type: messageType },
    });

    return {
      success: true,
      messageId: message.id,
      status: 'draft',
      reason,
    };
  }

  // Validate placeholders before sending
  const placeholderValidation = validatePlaceholders(messageText);

  if (!placeholderValidation.isValid) {
    console.log(`⚠️ Placeholder validation failed, falling back to draft. Unresolved: ${placeholderValidation.unresolvedPlaceholders.join(', ')}`);

    const message = await logMessage({
      conversationId,
      senderId,
      receiverId,
      body: messageText,
      direction: 'outbound',
      status: 'draft',
      metadata: { ...metadata, automated: true, type: messageType },
    });

    return {
      success: true,
      messageId: message.id,
      status: 'draft',
      reason: 'placeholder_validation_failed',
    };
  }

  // Attempt to send via Telnyx
  try {
    console.log(`📤 Auto-sending ${messageType} message via Telnyx...`);

    await sendSMS({
      from: agencyPhone,
      to: clientPhone,
      text: messageText,
    });

    console.log(`✅ Message sent successfully via Telnyx`);

    const message = await logMessage({
      conversationId,
      senderId,
      receiverId,
      body: messageText,
      direction: 'outbound',
      status: 'delivered',
      metadata: { ...metadata, automated: true, type: messageType },
    });

    return {
      success: true,
      messageId: message.id,
      status: 'sent',
      reason: 'auto_send',
    };
  } catch (error) {
    // Telnyx send failed - fall back to draft
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Telnyx send failed, falling back to draft: ${errorMessage}`);

    const message = await logMessage({
      conversationId,
      senderId,
      receiverId,
      body: messageText,
      direction: 'outbound',
      status: 'draft',
      metadata: { ...metadata, automated: true, type: messageType },
    });

    return {
      success: true,
      messageId: message.id,
      status: 'draft',
      reason: 'send_failed',
      error: errorMessage,
    };
  }
}

/**
 * Batch fetches auto-send settings for multiple agencies
 * Returns a Map of agencyId -> AutoSendSettings
 * Prevents N+1 queries when processing multiple messages
 */
export async function batchFetchAutoSendSettings(
  agencyIds: string[]
): Promise<Map<string, AutoSendSettings>> {
  const supabase = createAdminClient();

  // Deduplicate agency IDs
  const uniqueAgencyIds = [...new Set(agencyIds)];

  if (uniqueAgencyIds.length === 0) {
    return new Map();
  }

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
    // Return empty map - callers will use defaults
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

/**
 * Fetches auto-send settings for a single agency
 */
export async function fetchAutoSendSettings(
  agencyId: string
): Promise<AutoSendSettings | null> {
  const settingsMap = await batchFetchAutoSendSettings([agencyId]);
  return settingsMap.get(agencyId) || null;
}
