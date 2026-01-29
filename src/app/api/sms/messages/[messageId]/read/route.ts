// API ROUTE: /api/sms/messages/[messageId]/read
// Proxies to Django backend for marking messages as read

import { proxyPost } from '@/lib/api-proxy'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params
  return proxyPost(request, `/api/sms/messages/${messageId}/read/`)
}
