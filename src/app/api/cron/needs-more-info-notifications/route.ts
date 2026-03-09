/**
 * Needs More Info Notifications Cron Job
 * Runs every hour.
 */
import { NextRequest } from 'next/server'
import { validateCronSecret, callDjangoRunEndpoint } from '@/lib/cron-helpers'

export async function GET(request: NextRequest) {
  const authError = validateCronSecret(request)
  if (authError) return authError

  return callDjangoRunEndpoint('/needs-info-notifications/')
}
