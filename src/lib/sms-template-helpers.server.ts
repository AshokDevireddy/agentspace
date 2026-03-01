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

/**
 * Batch fetch agency SMS settings via Django API
 * Fetches settings for multiple agencies in parallel
 */
export async function batchFetchAgencySmsSettings(
  agencyIds: string[]
): Promise<Map<string, AgencySmsSettings>> {
  const uniqueIds = [...new Set(agencyIds)];
  if (uniqueIds.length === 0) return new Map();

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const settingsMap = new Map<string, AgencySmsSettings>();

  // Fetch all agencies in parallel
  const fetchPromises = uniqueIds.map(async (agencyId) => {
    try {
      const response = await fetch(`${apiUrl}/api/agencies/${agencyId}/settings/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': process.env.CRON_SECRET || '',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch settings for agency ${agencyId}:`, response.status);
        return null;
      }

      const data = await response.json();
      return {
        id: agencyId,
        sms_welcome_enabled: data.sms_welcome_enabled ?? null,
        sms_welcome_template: data.sms_welcome_template ?? null,
        sms_billing_reminder_enabled: data.sms_billing_reminder_enabled ?? null,
        sms_billing_reminder_template: data.sms_billing_reminder_template ?? null,
        sms_lapse_reminder_enabled: data.sms_lapse_reminder_enabled ?? null,
        sms_lapse_reminder_template: data.sms_lapse_reminder_template ?? null,
        sms_birthday_enabled: data.sms_birthday_enabled ?? null,
        sms_birthday_template: data.sms_birthday_template ?? null,
        sms_policy_packet_enabled: data.sms_policy_packet_enabled ?? null,
        sms_policy_packet_template: data.sms_policy_packet_template ?? null,
        sms_quarterly_enabled: data.sms_quarterly_enabled ?? null,
        sms_quarterly_template: data.sms_quarterly_template ?? null,
        sms_holiday_enabled: data.sms_holiday_enabled ?? null,
        sms_holiday_template: data.sms_holiday_template ?? null,
      } as AgencySmsSettings;
    } catch (error) {
      console.error(`Error fetching settings for agency ${agencyId}:`, error);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  for (const result of results) {
    if (result) {
      settingsMap.set(result.id, result);
    }
  }

  return settingsMap;
}
