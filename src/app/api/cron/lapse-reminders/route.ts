/**
 * Lapse Reminders Cron Job
 * Runs every 2 hours.
 */
import { NextRequest } from 'next/server'
import { validateCronSecret, callDjangoRunEndpoint } from '@/lib/cron-helpers'

export async function GET(request: NextRequest) {
  const authError = validateCronSecret(request)
  if (authError) return authError

  return callDjangoRunEndpoint('/lapse-reminders/')
}
