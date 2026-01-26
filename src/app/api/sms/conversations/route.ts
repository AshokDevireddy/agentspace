// API ROUTE: /api/sms/conversations
// Proxies to backend API for SMS conversations

import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Map frontend parameter names to backend
  const view = url.searchParams.get('view') || 'downlines'
  const countOnly = url.searchParams.get('countOnly')

  // If countOnly is true, use the unread-count endpoint instead
  if (countOnly === 'true') {
    const backendUrl = `/api/sms/unread-count/?view_mode=${encodeURIComponent(view)}`
    return proxyToBackend(request, backendUrl)
  }

  // Build backend URL with mapped params
  const backendUrl = new URL('/api/sms/conversations/', process.env.BACKEND_URL || 'http://localhost:8000')
  backendUrl.searchParams.set('view_mode', view)

  // Pass through other params
  const page = url.searchParams.get('page')
  const limit = url.searchParams.get('limit')
  const search = url.searchParams.get('search')

  if (page) backendUrl.searchParams.set('page', page)
  if (limit) backendUrl.searchParams.set('limit', limit)
  if (search) backendUrl.searchParams.set('search', search)

  return proxyToBackend(request, backendUrl.pathname + backendUrl.search)
}
