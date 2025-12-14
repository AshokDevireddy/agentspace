import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Use server client for auth (reads cookies properly)
    const supabase = await createServerClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ completed: false, carriers: [] })
    }

    // Get user's unique_carriers directly from users table
    const { data: userData } = await supabase
      .from('users')
      .select('unique_carriers')
      .eq('auth_user_id', authUser.id)
      .single()

    // unique_carriers is now text[], not JSONB
    const carriers: string[] = userData?.unique_carriers || []

    return NextResponse.json({
      completed: carriers.length > 0,
      carriers
    })
  } catch (error) {
    console.error('[API/NIPR/STATUS] Error:', error)
    return NextResponse.json({ completed: false, carriers: [] })
  }
}
