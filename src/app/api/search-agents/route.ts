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
    console.log('[SEARCH-AGENTS] === New search request ===')

    // Parse URL parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limitParam = searchParams.get('limit')

    console.log('[SEARCH-AGENTS] Query:', query, 'Limit:', limitParam)

    // Validate query parameter
    if (!query || query.trim().length < 2) {
      console.log('[SEARCH-AGENTS] Query too short or missing')
      return NextResponse.json({
        error: 'Search query must be at least 2 characters long'
      }, { status: 400 })
    }

    // Validate and set limit (default to 10, max 20 for performance)
    const limit = limitParam ? Math.min(parseInt(limitParam), 20) : 10
    if (isNaN(limit) || limit <= 0) {
      console.log('[SEARCH-AGENTS] Invalid limit')
      return NextResponse.json({
        error: 'Invalid limit parameter'
      }, { status: 400 })
    }

    console.log('[SEARCH-AGENTS] Creating Supabase clients...')
    // Create Supabase clients
    const supabase = createAdminClient()
    const userClient = await createServerClient()

    // Get authenticated user
    console.log('[SEARCH-AGENTS] Getting authenticated user...')
    const { data: { user: authUser } } = await userClient.auth.getUser()

    if (!authUser) {
      console.log('[SEARCH-AGENTS] No authenticated user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[SEARCH-AGENTS] Auth user ID:', authUser.id)

    // Get current user's data
    console.log('[SEARCH-AGENTS] Fetching current user data...')
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id, agency_id, perm_level, role')
      .eq('auth_user_id', authUser.id)
      .single()

    if (currentUserError || !currentUser) {
      console.error('[SEARCH-AGENTS] Current user error:', currentUserError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('[SEARCH-AGENTS] Current user:', {
      id: currentUser.id,
      agency_id: currentUser.agency_id,
      perm_level: currentUser.perm_level,
      role: currentUser.role
    })

    // Check if user is admin
    const isAdmin = currentUser.perm_level === 'admin' || currentUser.role === 'admin'
    console.log('[SEARCH-AGENTS] Is admin:', isAdmin)

    // Sanitize search query for SQL injection protection
    const sanitizedQuery = query.trim().replace(/[%_]/g, '\\$&')
    console.log('[SEARCH-AGENTS] Sanitized query:', sanitizedQuery)

    // Split the search query into individual words for better matching
    const searchWords = sanitizedQuery.split(/\s+/).filter(word => word.length > 0)
    console.log('[SEARCH-AGENTS] Search words:', searchWords)

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

    console.log('[SEARCH-AGENTS] OR conditions:', orConditions.length, 'conditions')
    console.log('[SEARCH-AGENTS] Sample conditions:', orConditions.slice(0, 3))

    let allAgents: any[] = []

    if (isAdmin) {
      console.log('[SEARCH-AGENTS] Admin search - querying agency:', currentUser.agency_id)
      // For admins: Query directly on agency_id (no .in() clause with large arrays)
      const { data, error: searchError } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          status
        `)
        .eq('agency_id', currentUser.agency_id)
        .neq('role', 'client') // Exclude clients
        .or(orConditions.join(','))
        .order('last_name', { ascending: true })
        .limit(50) // Get more results to filter client-side

      if (searchError) {
        console.error('[SEARCH-AGENTS] Admin search error:', searchError)
        console.error('[SEARCH-AGENTS] Error details:', JSON.stringify(searchError, null, 2))
        return NextResponse.json({
          error: 'Search failed',
          detail: searchError.message || 'Database search encountered an error'
        }, { status: 500 })
      }

      allAgents = data || []
      console.log('[SEARCH-AGENTS] Admin search returned', allAgents.length, 'results')
    } else {
      console.log('[SEARCH-AGENTS] Non-admin search - fetching downline for:', currentUser.id)
      // For non-admins: Get downline first, then search within it
      const { data: downline, error: downlineError } = await supabase.rpc('get_agent_downline', {
        agent_id: currentUser.id
      })

      if (downlineError) {
        console.error('[SEARCH-AGENTS] Downline fetch error:', downlineError)
        return NextResponse.json({
          error: 'Failed to fetch downline',
          detail: downlineError.message
        }, { status: 500 })
      }

      const visibleAgentIds = [currentUser.id, ...((downline as any[])?.map((u: any) => u.id) || [])]
      console.log('[SEARCH-AGENTS] Found', visibleAgentIds.length, 'visible agents in downline')

      // If downline is too large (>100), we should use a different approach
      if (visibleAgentIds.length > 100) {
        console.log('[SEARCH-AGENTS] Large downline detected, using optimized query')
        // For large downlines, query all and filter client-side
        const { data, error: searchError } = await supabase
          .from('users')
          .select(`
            id,
            first_name,
            last_name,
            email,
            status
          `)
          .eq('agency_id', currentUser.agency_id)
          .neq('role', 'client')
          .eq('status', 'active') // Non-admins only see active users
          .or(orConditions.join(','))
          .order('last_name', { ascending: true })
          .limit(100)

        if (searchError) {
          console.error('[SEARCH-AGENTS] Large downline search error:', searchError)
          return NextResponse.json({
            error: 'Search failed',
            detail: searchError.message || 'Database search encountered an error'
          }, { status: 500 })
        }

        // Filter client-side to only visible agents
        allAgents = (data || []).filter((agent: any) => visibleAgentIds.includes(agent.id))
      } else {
        // Small downline - use .in() filter
        const { data, error: searchError } = await supabase
          .from('users')
          .select(`
            id,
            first_name,
            last_name,
            email,
            status
          `)
          .in('id', visibleAgentIds)
          .neq('role', 'client')
          .eq('status', 'active') // Non-admins only see active users
          .or(orConditions.join(','))
          .order('last_name', { ascending: true })
          .limit(50)

        if (searchError) {
          console.error('[SEARCH-AGENTS] Small downline search error:', searchError)
          return NextResponse.json({
            error: 'Search failed',
            detail: searchError.message || 'Database search encountered an error'
          }, { status: 500 })
        }

        allAgents = data || []
      }

      console.log('[SEARCH-AGENTS] Non-admin search returned', allAgents.length, 'results')
    }

    // Client-side filtering for multi-word searches to ensure all words match
    let filteredAgents = allAgents || []

    if (searchWords.length > 1) {
      console.log('[SEARCH-AGENTS] Filtering', filteredAgents.length, 'results for multi-word match')
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
      console.log('[SEARCH-AGENTS] After filtering:', filteredAgents.length, 'results')
    }

    // Apply the limit after filtering
    const agents = filteredAgents.slice(0, limit)
    console.log('[SEARCH-AGENTS] Returning', agents.length, 'agents')

    // Return search results
    // Note: Only returning safe, non-sensitive fields (no admin flags, goals, etc.)
    return NextResponse.json(agents || [])

  } catch (error) {
    console.error('[SEARCH-AGENTS] Unexpected API Error:', error)
    console.error('[SEARCH-AGENTS] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      error: 'Internal Server Error',
      detail: error instanceof Error ? error.message : 'An unexpected error occurred during search'
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