import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Use server client for auth (reads cookies properly)
    const supabase = await createServerClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ completed: false, carriers: [] })
    }

    // Get user's agency_id from users table
    const { data: userData } = await supabase
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userData?.agency_id) {
      return NextResponse.json({ completed: false, carriers: [] })
    }

    // Use admin client to read agencies table (bypasses RLS)
    const adminClient = createAdminClient()
    const { data: agency } = await adminClient
      .from('agencies')
      .select('unique_carriers')
      .eq('id', userData.agency_id)
      .single()

    // Handle both formats: plain array OR {carriers: [...]} object
    let carriers: string[] = []
    const uniqueCarriers = agency?.unique_carriers

    if (Array.isArray(uniqueCarriers)) {
      // Data is stored as plain array
      carriers = uniqueCarriers
    } else if (uniqueCarriers && typeof uniqueCarriers === 'object' && 'carriers' in uniqueCarriers) {
      // Data is stored as {carriers: [...]} object
      carriers = (uniqueCarriers as { carriers: string[] }).carriers || []
    }

    return NextResponse.json({
      completed: carriers.length > 0,
      carriers
    })
  } catch (error) {
    console.error('[API/NIPR/STATUS] Error:', error)
    return NextResponse.json({ completed: false, carriers: [] })
  }
}
