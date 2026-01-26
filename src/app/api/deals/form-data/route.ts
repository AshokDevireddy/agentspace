/**
 * Deals Form Data API Route
 *
 * Proxies to Django backend for Post A Deal form data.
 */

import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/api/deals/form-data')
}
