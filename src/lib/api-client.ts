/**
 * Centralized API client for backend requests.
 */

export interface FetchApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export async function fetchApi<T>(
  url: string,
  accessToken: string,
  errorMessage: string,
  options: FetchApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || errorMessage)
  }

  return response.json()
}

export interface FetchWithCredentialsOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export async function fetchWithCredentials<T>(
  url: string,
  errorMessage: string,
  options: FetchWithCredentialsOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorMessage)
  }

  return response.json()
}
