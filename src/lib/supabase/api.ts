const getSupabaseConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
})

const DEFAULT_TIMEOUT_MS = 10000

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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${url}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      signal: controller.signal,
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
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        data: null,
        error: 'Request timed out',
        status: 0
      }
    }
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
      status: 0
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

