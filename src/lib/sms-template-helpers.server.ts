import { createAdminClient } from '@/lib/supabase/server';

export interface AgencySmsSettings {
  id: string;
  sms_welcome_enabled: boolean | null;
  sms_welcome_template: string | null;
  sms_billing_reminder_enabled: boolean | null;
  sms_billing_reminder_template: string | null;
  sms_lapse_reminder_enabled: boolean | null;
  sms_lapse_reminder_template: string | null;
  sms_birthday_enabled: boolean | null;
  sms_birthday_template: string | null;
  sms_policy_packet_enabled: boolean | null;
  sms_policy_packet_template: string | null;
  sms_quarterly_enabled: boolean | null;
  sms_quarterly_template: string | null;
  sms_holiday_enabled: boolean | null;
  sms_holiday_template: string | null;
}

export async function batchFetchAgencySmsSettings(
  agencyIds: string[]
): Promise<Map<string, AgencySmsSettings>> {
  const uniqueIds = [...new Set(agencyIds)];
  if (uniqueIds.length === 0) return new Map();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('agencies')
    .select(`
      id,
      sms_welcome_enabled,
      sms_welcome_template,
      sms_billing_reminder_enabled,
      sms_billing_reminder_template,
      sms_lapse_reminder_enabled,
      sms_lapse_reminder_template,
      sms_birthday_enabled,
      sms_birthday_template,
      sms_policy_packet_enabled,
      sms_policy_packet_template,
      sms_quarterly_enabled,
      sms_quarterly_template,
      sms_holiday_enabled,
      sms_holiday_template
    `)
    .in('id', uniqueIds);

  const settingsMap = new Map<string, AgencySmsSettings>();
  if (data) {
    for (const agency of data) {
      settingsMap.set(agency.id, agency);
    }
  }
  return settingsMap;
}
