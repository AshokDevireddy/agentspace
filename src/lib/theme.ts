import { createClient } from '@/lib/supabase/client'

export type ThemeMode = 'light' | 'dark' | 'system'

export async function updateUserTheme(theme: ThemeMode): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return { success: false, error: 'No authenticated session' }
  }

  const response = await fetch('/api/user/theme', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ theme })
  })

  if (!response.ok) {
    const data = await response.json()
    return { success: false, error: data.error || 'Failed to update theme' }
  }

  return { success: true }
}
