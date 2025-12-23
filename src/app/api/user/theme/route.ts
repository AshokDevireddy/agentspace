import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function authenticateAndAuthorize(request: Request) {
  const supabase = createAdminClient()
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 }) }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 }) }
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (userError || !userData) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }

  if (userData.role === 'client') {
    return {
      error: NextResponse.json(
        { error: 'Clients cannot change theme preferences', reason: 'role_restriction' },
        { status: 403 }
      )
    }
  }

  return { user, supabase }
}

/**
 * PUT /api/user/theme
 * Updates a user's theme preference
 * Only admins and agents can change themes; clients cannot
 */
export async function PUT(request: Request) {
  try {
    const auth = await authenticateAndAuthorize(request)
    if (auth.error) return auth.error

    const { user, supabase } = auth
    const body = await request.json()
    const { theme } = body

    if (theme !== null && !['light', 'dark', 'system'].includes(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme. Must be "light", "dark", "system", or null' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ theme_mode: theme })
      .eq('auth_user_id', user.id)

    if (updateError) {
      console.error('Error updating theme preference:', updateError)
      return NextResponse.json({ error: 'Failed to update theme preference' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Theme preference updated successfully',
      data: { theme }
    })
  } catch (error) {
    console.error('API Error (PUT /api/user/theme):', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

