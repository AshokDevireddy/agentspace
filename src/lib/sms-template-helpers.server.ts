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
      sms_birthday_template
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
