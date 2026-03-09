/**
 * Birthday Messages Cron Job
 * Runs daily at 9 AM UTC.
 */
import { NextRequest } from 'next/server'
import { validateCronSecret, callDjangoRunEndpoint } from '@/lib/cron-helpers'

export async function GET(request: NextRequest) {
  const authError = validateCronSecret(request)
  if (authError) return authError

  return callDjangoRunEndpoint('/birthday-messages/')
}
