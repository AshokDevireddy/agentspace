/**
 * Holiday Messages Cron Job
 * Runs daily at 8 AM UTC — Django auto-detects US federal holidays.
 */
import { NextRequest } from 'next/server'
import { validateCronSecret, callDjangoRunEndpoint } from '@/lib/cron-helpers'

export async function GET(request: NextRequest) {
  const authError = validateCronSecret(request)
  if (authError) return authError

  return callDjangoRunEndpoint('/holiday-messages/')
}
