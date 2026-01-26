/**
 * Products by Carrier API Route
 *
 * Proxies to Django backend for getting products for a specific carrier.
 */

import { NextRequest } from 'next/server'
import { proxyGetWithParams } from '@/lib/api-proxy'

export async function GET(request: NextRequest) {
  return proxyGetWithParams(request, '/api/deals/products-by-carrier')
}
