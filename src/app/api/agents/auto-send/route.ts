// API ROUTE: /api/agents/auto-send
// Proxies to backend API for SMS auto-send per-agent overrides

import { proxyGetWithParams, proxyPatch } from '@/lib/api-proxy'

export async function GET(request: Request) {
  return proxyGetWithParams(request, '/api/agents/auto-send/')
}

export async function PATCH(request: Request) {
  return proxyPatch(request, '/api/agents/auto-send/')
}
