import { NextRequest } from 'next/server'
import { sendMessagesByIds } from '@/lib/sms-send-messages'

export async function POST(request: NextRequest) {
  return sendMessagesByIds(request, {
    sourceStatus: 'failed',
    resultKey: 'retried',
    logLabel: 'Failed',
  })
}
