'use server'

import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Types
interface ActionResult {
  success: boolean
  error?: string
  redirectTo?: string
}

interface UserProfile {
  id: string
  role: 'admin' | 'agent' | 'client'
  status: 'invited' | 'onboarding' | 'active' | 'inactive'
  agency_id: string
}

// Helper to determine redirect based on role
function getRedirectUrl(profile: UserProfile): string {
  if (profile.status === 'onboarding') {
    return '/setup-account'
  }
  if (profile.role === 'client') {
    return '/client/dashboard'
  }
  return '/'
}

/**
 * Login with email and password
 */
export async function login(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { success: false, error: 'Email and password are required' }
  }

  const supabase = await createServerClient()

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message || 'Invalid login credentials' }
  }

  // Fetch user profile
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('id, role, status, agency_id')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (profileError || !userProfile) {
    await supabase.auth.signOut()
    return { success: false, error: 'User profile not found' }
  }

  // Check user status
  if (userProfile.status === 'invited') {
    await supabase.auth.signOut()
    return { success: false, error: 'Please check your email and click the invite link to complete account setup' }
  }

  if (userProfile.status === 'inactive') {
    await supabase.auth.signOut()
    return { success: false, error: 'Your account has been deactivated' }
  }

  revalidatePath('/', 'layout')

  return {
    success: true,
    redirectTo: getRedirectUrl(userProfile as UserProfile),
  }
}

/**
 * Sign up a new admin user with agency
 */
export async function signup(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phoneNumber = formData.get('phoneNumber') as string | null
  const agencyName = formData.get('agencyName') as string

  if (!email || !firstName || !lastName || !agencyName) {
    return { success: false, error: 'Missing required fields' }
  }

  const supabaseAdmin = createAdminClient()

  // Check if user already exists
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, status, auth_user_id, agency_id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    if (existingUser.status === 'active') {
      return { success: false, error: 'This email is already registered. Please log in.' }
    }

    // Handle resend for invited/onboarding users
    if (existingUser.status === 'invited' || existingUser.status === 'onboarding') {
      // Delete old auth account first
      if (existingUser.auth_user_id) {
        await supabaseAdmin
          .from('users')
          .update({ auth_user_id: null })
          .eq('id', existingUser.id)

        await supabaseAdmin.auth.admin.deleteUser(existingUser.auth_user_id)
      }

      // Create new auth user and send invite
      const { data: newAuthData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback` }
      )

      if (inviteError) {
        return { success: false, error: inviteError.message || 'Failed to send invitation' }
      }

      // Update user record
      await supabaseAdmin
        .from('users')
        .update({
          auth_user_id: newAuthData.user.id,
          status: 'invited',
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)

      return { success: true }
    }

    return { success: false, error: 'A user with this email already exists' }
  }

  // Create new agency
  const { data: agencyData, error: agencyError } = await supabaseAdmin
    .from('agencies')
    .insert([{
      name: agencyName,
      code: agencyName.toLowerCase().replace(/\s+/g, '-'),
      display_name: agencyName,
      is_active: true,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (agencyError) {
    return { success: false, error: 'Failed to create agency' }
  }

  // Create auth user and send invite
  const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback` }
  )

  if (inviteError) {
    // Cleanup agency
    await supabaseAdmin.from('agencies').delete().eq('id', agencyData.id)
    return { success: false, error: inviteError.message || 'Failed to send invitation' }
  }

  // Create user record
  const { error: dbError } = await supabaseAdmin
    .from('users')
    .insert([{
      id: authData.user.id,
      auth_user_id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber || null,
      role: 'admin',
      upline_id: null,
      annual_goal: 0,
      perm_level: 'admin',
      is_admin: true,
      status: 'invited',
      total_prod: 0,
      total_policies_sold: 0,
      start_date: new Date().toISOString().split('T')[0],
      agency_id: agencyData.id,
      theme_mode: 'system',
    }])

  if (dbError) {
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('agencies').delete().eq('id', agencyData.id)
    return { success: false, error: dbError.message || 'Failed to create user record' }
  }

  return { success: true }
}

/**
 * Sign out the current user
 */
export async function signout(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Request password reset email
 */
export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string

  if (!email) {
    return { success: false, error: 'Email is required' }
  }

  const supabaseAdmin = createAdminClient()

  // Check if user exists (but don't reveal this to caller)
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, auth_user_id, agency_id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser?.auth_user_id) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = existingUser.agency_id
      ? `${baseUrl}/auth/callback?next=/forgot-password&agency_id=${existingUser.agency_id}`
      : `${baseUrl}/auth/callback?next=/forgot-password`

    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })
  }

  // Always return success to prevent email enumeration
  return { success: true }
}

/**
 * Update password for authenticated user
 */
export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const password = formData.get('password') as string

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' }
  }

  const supabase = await createServerClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Session expired. Please use the password reset link again.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    return { success: false, error: updateError.message || 'Failed to update password' }
  }

  return { success: true }
}

/**
 * Complete onboarding - update user profile and password
 */
export async function completeOnboarding(formData: FormData): Promise<ActionResult> {
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phoneNumber = formData.get('phoneNumber') as string
  const password = formData.get('password') as string

  if (!firstName || !lastName || !phoneNumber || !password) {
    return { success: false, error: 'All fields are required' }
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' }
  }

  const supabase = await createServerClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Session expired. Please use your invitation link again.' }
  }

  // Update password
  const { error: passwordError } = await supabase.auth.updateUser({ password })

  if (passwordError) {
    return { success: false, error: passwordError.message || 'Failed to set password' }
  }

  // Get user profile to check role
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!userProfile) {
    return { success: false, error: 'User profile not found' }
  }

  // Update profile - clients go directly to active, admins/agents stay in onboarding for wizard
  const updateData: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
    updated_at: new Date().toISOString(),
  }

  // Only clients skip the onboarding wizard
  if (userProfile.role === 'client') {
    updateData.status = 'active'
  }

  const { error: profileError } = await supabase
    .from('users')
    .update(updateData)
    .eq('auth_user_id', user.id)

  if (profileError) {
    return { success: false, error: 'Failed to update profile' }
  }

  // Sign out so user logs in fresh
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')

  return {
    success: true,
    redirectTo: '/login?message=setup-complete',
  }
}

/**
 * Mark onboarding wizard as complete (Phase 2)
 */
export async function markOnboardingComplete(): Promise<ActionResult> {
  const supabase = await createServerClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('auth_user_id', user.id)

  if (updateError) {
    return { success: false, error: 'Failed to complete onboarding' }
  }

  revalidatePath('/', 'layout')

  return { success: true }
}
