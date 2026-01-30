// API ROUTE: /api/create-user
// This endpoint creates a new user and sends an invitation email
// Redirects to Django backend endpoint POST /api/agents/invite/

import { proxyPost } from '@/lib/api-proxy'

export async function POST(request: Request) {
  // Redirect to the agents invite endpoint which handles user creation
  return proxyPost(request, '/api/agents/invite/')
}
