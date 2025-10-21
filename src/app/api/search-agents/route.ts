// API ROUTE: /api/search-agents
// This endpoint provides secure agent search functionality with the following features:
// - Authentication verification
// - Input validation and sanitization
// - Efficient database queries with proper indexing
// - Limited result sets to prevent performance issues
// - Only returns safe, non-sensitive user fields
// - Respects downline hierarchy (users can only search their downline)

import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Parse URL parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limitParam = searchParams.get('limit')

    // Validate query parameter
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        error: 'Search query must be at least 2 characters long'
      }, { status: 400 })
    }

    // Validate and set limit (default to 10, max 20 for performance)
    const limit = limitParam ? Math.min(parseInt(limitParam), 20) : 10
    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json({
        error: 'Invalid limit parameter'
      }, { status: 400 })
    }

    // Create Supabase clients
    const supabase = createAdminClient()
    const userClient = await createServerClient()

    // Get authenticated user
    const { data: { user: authUser } } = await userClient.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's data
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (currentUserError || !currentUser) {
      console.error('Current user error:', currentUserError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch user's downline using RPC function
    const { data: downline, error: downlineError } = await supabase.rpc('get_agent_downline', {
      agent_id: currentUser.id
    })

    if (downlineError) {
      console.error('Downline fetch error:', downlineError)
      return NextResponse.json({
        error: 'Failed to fetch downline',
        detail: downlineError.message
      }, { status: 500 })
    }

    // Build list of visible agent IDs (current user + their downline)
    const visibleAgentIds: string[] = [currentUser.id, ...((downline as any[])?.map((u: any) => u.id) || [])]

    // Sanitize search query for SQL injection protection
    const sanitizedQuery = query.trim().replace(/[%_]/g, '\\$&')

    // Split the search query into individual words for better matching
    const searchWords = sanitizedQuery.split(/\s+/).filter(word => word.length > 0)

    // Perform efficient database search using PostgreSQL ILIKE for case-insensitive search
    // This query searches across first_name, last_name, and email fields
    // Uses existing indexes for optimal performance

    // Build OR conditions that search for individual words in fields
    const orConditions = []

    // Always search for the full query in individual fields
    orConditions.push(`first_name.ilike.%${sanitizedQuery}%`)
    orConditions.push(`last_name.ilike.%${sanitizedQuery}%`)
    orConditions.push(`email.ilike.%${sanitizedQuery}%`)

    // For multi-word searches, also search for individual words
    if (searchWords.length > 1) {
      for (const word of searchWords) {
        const sanitizedWord = word.replace(/[%_]/g, '\\$&')
        orConditions.push(`first_name.ilike.%${sanitizedWord}%`)
        orConditions.push(`last_name.ilike.%${sanitizedWord}%`)
        orConditions.push(`email.ilike.%${sanitizedWord}%`)
      }
    }

    const { data: allAgents, error: searchError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email
      `)
      .in('id', visibleAgentIds) // Only search within downline
      .neq('role', 'client') // Exclude clients
      .eq('status', 'active') // Only return active users
      .or(orConditions.join(','))
      .order('last_name', { ascending: true })
      .limit(50) // Get more results to filter client-side

    if (searchError) {
      console.error('Agent search error:', searchError)
      return NextResponse.json({
        error: 'Search failed',
        detail: 'Database search encountered an error'
      }, { status: 500 })
    }

    // Client-side filtering for multi-word searches to ensure all words match
    let filteredAgents = allAgents || []

    if (searchWords.length > 1) {
      filteredAgents = filteredAgents.filter(agent => {
        const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase()
        const email = agent.email ? agent.email.toLowerCase() : ''
        const queryLower = sanitizedQuery.toLowerCase()

        // Check if the full query matches anywhere in the full name or email
        if (fullName.includes(queryLower) || email.includes(queryLower)) {
          return true
        }

        // Check if all individual words appear in the full name or email
        return searchWords.every(word => {
          const wordLower = word.toLowerCase()
          return fullName.includes(wordLower) || email.includes(wordLower)
        })
      })
    }

    // Apply the limit after filtering
    const agents = filteredAgents.slice(0, limit)

    // Return search results
    // Note: Only returning safe, non-sensitive fields (no admin flags, goals, etc.)
    return NextResponse.json(agents || [])

  } catch (error) {
    console.error('API Error in search-agents:', error)
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: 'An unexpected error occurred during search'
    }, { status: 500 })
  }
}

// Optionally, you could add rate limiting here using a middleware or library
// For production, consider implementing:
// 1. Rate limiting per user (e.g., 100 requests per minute)
// 2. Caching frequently searched terms
// 3. Additional logging for monitoring and security

// Future enhancements you could add:
// 1. Server-side caching with Redis
// 2. Smarter debouncing based on user typing patterns
// 3. Prefetch popular searches
// 4. Search result ranking/relevance scoring