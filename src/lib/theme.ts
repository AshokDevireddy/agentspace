import { getClientAccessToken } from '@/lib/auth/client'

export type ThemeMode = 'light' | 'dark' | 'system'

export async function updateUserTheme(theme: ThemeMode): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getClientAccessToken()

  if (!accessToken) {
    return { success: false, error: 'No authenticated session' }
  }

  const response = await fetch('/api/user/theme', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ theme })
  })

  if (!response.ok) {
    const data = await response.json()
    return { success: false, error: data.error || 'Failed to update theme' }
  }

  return { success: true }
}
