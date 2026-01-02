const getSupabaseConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
})

interface FetchOptions {
  accessToken: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: object
}

export async function supabaseRestFetch<T = unknown>(
  endpoint: string,
  options: FetchOptions
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { url, anonKey } = getSupabaseConfig()

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${options.accessToken}`,
    'apikey': anonKey,
    'Content-Type': 'application/json'
  }

  if (options.method === 'PATCH') {
    headers['Prefer'] = 'return=minimal'
  }

  try {
    const response = await fetch(`${url}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      ...(options.body && { body: JSON.stringify(options.body) })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        data: null,
        error: errorData.message || errorData.error_description || `Request failed with status ${response.status}`,
        status: response.status
      }
    }

    if (options.method === 'PATCH' || options.method === 'DELETE') {
      return { data: null, error: null, status: response.status }
    }

    const data = await response.json()
    return { data, error: null, status: response.status }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
      status: 0
    }
  }
}

export async function supabaseAuthFetch<T = unknown>(
  endpoint: string,
  options: FetchOptions
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { url, anonKey } = getSupabaseConfig()

  try {
    const response = await fetch(`${url}/auth/v1${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${options.accessToken}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      ...(options.body && { body: JSON.stringify(options.body) })
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        data: null,
        error: data?.error_description || data?.msg || `Request failed with status ${response.status}`,
        status: response.status
      }
    }

    return { data, error: null, status: response.status }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
      status: 0
    }
  }
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ data: { access_token: string; refresh_token: string } | null; error: string | null }> {
  const { url, anonKey } = getSupabaseConfig()

  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey
      },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        data: null,
        error: data.error_description || data.msg || 'Invalid login credentials'
      }
    }

    return {
      data: { access_token: data.access_token, refresh_token: data.refresh_token },
      error: null
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

export async function updatePassword(
  accessToken: string,
  newPassword: string
): Promise<{ success: boolean; error: string | null }> {
  const result = await supabaseAuthFetch('/user', {
    accessToken,
    method: 'PUT',
    body: { password: newPassword }
  })

  return {
    success: result.error === null,
    error: result.error
  }
}
