import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// This route is PUBLIC - no authentication required
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({
        error: 'Email is required'
      }, { status: 400 })
    }

    // Use admin client only (no user authentication needed)
    const supabaseAdmin = createAdminClient()

    // Check if user exists (but don't reveal this information to prevent enumeration)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, status, auth_user_id, agency_id')
      .eq('email', email)
      .maybeSingle()

    // Even if user doesn't exist, we'll return success to prevent email enumeration
    // But only send the email if the user actually exists
    if (existingUser && existingUser.auth_user_id) {
      // Get agency info for white-label redirect URL
      let redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forgot-password`

      if (existingUser.agency_id) {
        const { data: agencyData } = await supabaseAdmin
          .from('agencies')
          .select('whitelabel_domain')
          .eq('id', existingUser.agency_id)
          .single()

        if (agencyData?.whitelabel_domain) {
          const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
          redirectUrl = `${protocol}://${agencyData.whitelabel_domain}/forgot-password`
        }
      }

      // Use resetPasswordForEmail - this actually sends the email using Supabase's email service
      // We use the admin client but call the regular auth method which will use SMTP
      // This is similar to how inviteUserByEmail works for invitations
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      })

      if (resetError) {
        console.error('Error sending password reset email:', resetError)
        console.error('Reset error details:', JSON.stringify(resetError, null, 2))
        // Don't reveal the error to the user for security reasons
      } else {
        console.log('Password reset email sent successfully to:', email)
        // Supabase will send the email using the configured SMTP (Resend) and the Reset Password template
      }
    } else {
      console.log('User not found or has no auth_user_id, but returning success message anyway:', email)
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message: 'If an account exists for this email, a reset link has been sent.'
    })
  } catch (error: any) {
    console.error('Unexpected error in password reset:', error)
    // Return generic error to avoid leaking information
    return NextResponse.json({
      success: true,
      message: 'If an account exists for this email, a reset link has been sent.'
    })
  }
}

