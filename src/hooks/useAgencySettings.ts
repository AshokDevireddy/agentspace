/**
 * Hook for fetching agency settings from Django API
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { queryKeys } from './queryKeys'

export interface AgencySettings {
  id: string
  name: string
  display_name: string | null
  logo_url: string | null
  primary_color: string | null
  whitelabel_domain: string | null
  phone_number: string | null
  messaging_enabled: boolean
  lead_sources: string[]
  discord_webhook_url: string | null
  discord_notification_enabled: boolean
  discord_notification_template: string | null
  discord_bot_username: string | null
  theme_mode: string | null
  lapse_email_notifications_enabled: boolean
  lapse_email_subject: string | null
  lapse_email_body: string | null
  sms_welcome_enabled: boolean
  sms_welcome_template: string | null
  sms_billing_reminder_enabled: boolean
  sms_billing_reminder_template: string | null
  sms_lapse_reminder_enabled: boolean
  sms_lapse_reminder_template: string | null
  sms_birthday_enabled: boolean
  sms_birthday_template: string | null
  sms_holiday_enabled: boolean
  sms_holiday_template: string | null
  sms_quarterly_enabled: boolean
  sms_quarterly_template: string | null
  sms_policy_packet_enabled: boolean
  sms_policy_packet_template: string | null
  default_scoreboard_start_date: string | null
  sms_auto_send_enabled: boolean
}

/**
 * Fetch agency settings from Django API
 */
export function useAgencySettings(agencyId?: string | null) {
  const { user } = useAuth()

  return useQuery<AgencySettings>({
    queryKey: queryKeys.configurationAgency(),
    queryFn: async () => {
      const id = agencyId || user?.agency_id
      if (!id) {
        throw new Error('No agency ID available')
      }

      const response = await fetch(`/api/agencies/${id}/settings`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to fetch agency settings')
      }

      return response.json()
    },
    enabled: !!(agencyId || user?.agency_id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
