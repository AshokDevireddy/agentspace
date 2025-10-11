// API ROUTE: /api/validate-agent/[agentId]
// This endpoint validates if a specific agent ID exists and is active
// Used during form validation to ensure selected upline agents are valid
// THIS ENDPOINT IS NOT CURRENTLY IN USE - COULD BE USED AT SOME POINT IN THE FUTURE OR REMOVED

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = params

    // Validate agent ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!agentId || !uuidRegex.test(agentId)) {
      return NextResponse.json({ 
        exists: false,
        error: 'Invalid agent ID format' 
      }, { status: 400 })
    }

    // Create admin Supabase client
    // Security: Middleware protects this route from non-admin access
    const supabase = createAdminClient()

    // Check if agent exists and is active
    const { data: agent, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('id', agentId)
      .eq('is_active', true)
      .single()

    if (fetchError) {
      // If error is "PGRST116" it means no rows returned (agent doesn't exist)
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ exists: false })
      }
      
      console.error('Agent validation error:', fetchError)
      return NextResponse.json({ 
        exists: false,
        error: 'Database query failed'
      }, { status: 500 })
    }

    // Return validation result
    return NextResponse.json({ 
      exists: !!agent,
      agentId: agent?.id 
    })

  } catch (error) {
    console.error('API Error in validate-agent:', error)
    return NextResponse.json({ 
      exists: false,
      error: 'Internal Server Error'
    }, { status: 500 })
  }
} 