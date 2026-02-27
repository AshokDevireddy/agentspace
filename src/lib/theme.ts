import { apiClient } from '@/lib/api-client'

export type ThemeMode = 'light' | 'dark' | 'system'

export async function updateUserTheme(theme: ThemeMode): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.put('/api/user/profile/', { themeMode: theme })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update theme'
    return { success: false, error: message }
  }
}
