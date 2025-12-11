import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Update the user status to 'active'
    const { error: updateError } = await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('auth_user_id', user.id)

    if (updateError) {
      console.error('Error updating user status:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to complete onboarding' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully'
    })
  } catch (error) {
    console.error('Error in complete-onboarding API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
