import { type NextRequest } from 'next/server'
import { proxyGet, proxyPut } from '@/lib/proxy-helpers'

export async function GET(request: NextRequest) {
  return proxyGet(request, '/api/user/profile/')
}

export async function PUT(request: NextRequest) {
  return proxyPut(request, '/api/user/profile/')
}
