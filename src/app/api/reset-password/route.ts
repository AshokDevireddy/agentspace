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

    // Check if user exists and get their agency (but don't reveal this information to prevent enumeration)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, status, auth_user_id, agency_id, agencies(name)')
      .eq('email', email)
      .maybeSingle()

    // Even if user doesn't exist, we'll return success to prevent email enumeration
    // But only send the email if the user actually exists
    if (existingUser && existingUser.auth_user_id) {
      // WHITE-LABEL AUTH STRATEGY:
      // Password reset uses hash fragments (implicit flow), not PKCE
      // So we redirect directly to /forgot-password which handles hash tokens client-side
      // Include whitelabel_domain in URL so we can redirect back after password reset

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const agencyData = existingUser.agencies as any
      const whitelabelDomain = agencyData?.whitelabel_domain

      let redirectUrl = `${baseUrl}/forgot-password`
      if (whitelabelDomain) {
        // Include whitelabel domain in URL params so forgot-password page can redirect back
        redirectUrl = `${baseUrl}/forgot-password?whitelabel_domain=${encodeURIComponent(whitelabelDomain)}`
      }

      console.log('Sending password reset email with redirectTo:', redirectUrl)

      // Get agency name for email template
      const agencyName = agencyData?.name || 'AgentSpace'

      console.log('Sending password reset for user in agency:', agencyName)

      // LIMITATION: Supabase's resetPasswordForEmail does NOT support custom data like inviteUserByEmail
      // User metadata is also not reliably available in password reset email templates
      // SOLUTION: Either use a generic subject line, or implement custom email sending via Resend
      // For now, we'll use the standard Supabase email (you may want to make subject generic)

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

