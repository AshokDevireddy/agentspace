/**
 * Hook for fetching agency settings from backend API
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/providers/AuthProvider'
import { queryKeys } from './queryKeys'

export interface AgencySettings {
  id: string
  name: string
  displayName: string | null
  logoUrl: string | null
  primaryColor: string | null
  whitelabelDomain: string | null
  phoneNumber: string | null
  messagingEnabled: boolean
  leadSources: string[]
  discordWebhookUrl: string | null
  discordNotificationEnabled: boolean
  discordNotificationTemplate: string | null
  discordBotUsername: string | null
  themeMode: string | null
  lapseEmailNotificationsEnabled: boolean
  lapseEmailSubject: string | null
  lapseEmailBody: string | null
  smsWelcomeEnabled: boolean
  smsWelcomeTemplate: string | null
  smsBillingReminderEnabled: boolean
  smsBillingReminderTemplate: string | null
  smsLapseReminderEnabled: boolean
  smsLapseReminderTemplate: string | null
  smsBirthdayEnabled: boolean
  smsBirthdayTemplate: string | null
  smsHolidayEnabled: boolean
  smsHolidayTemplate: string | null
  smsQuarterlyEnabled: boolean
  smsQuarterlyTemplate: string | null
  smsPolicyPacketEnabled: boolean
  smsPolicyPacketTemplate: string | null
  defaultScoreboardStartDate: string | null
  smsAutoSendEnabled: boolean
  scoreboardAgentVisibility: boolean
}

/**
 * Fetch agency settings from backend API
 */
export function useAgencySettings(agencyId?: string | null) {
  const { user } = useAuth()

  return useQuery<AgencySettings>({
    queryKey: queryKeys.configurationAgency(),
    queryFn: async () => {
      const id = agencyId || user?.agencyId
      if (!id) {
        throw new Error('No agency ID available')
      }

      return apiClient.get<AgencySettings>(`/api/agencies/${id}/settings/`)
    },
    enabled: !!(agencyId || user?.agencyId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
