/**
 * Quarterly Check-in Cron Job
 * Runs daily at 8 AM UTC.
 */
import { NextRequest } from 'next/server'
import { validateCronSecret, callDjangoRunEndpoint } from '@/lib/cron-helpers'

export async function GET(request: NextRequest) {
  const authError = validateCronSecret(request)
  if (authError) return authError

  return callDjangoRunEndpoint('/quarterly-checkins/')
}
