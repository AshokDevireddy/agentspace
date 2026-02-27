/**
 * Centralized API client for direct backend calls.
 *
 * Replaces the Next.js proxy pattern (browser → Next.js → backend)
 * with direct calls (browser → backend) using JWT Bearer auth.
 *
 * Features:
 * - JWT auth via getClientAccessToken() with automatic 401 retry
 * - Request body: camelCase → snake_case
 * - Response body: snake_case → camelCase
 * - Trailing slash normalization (Django APPEND_SLASH)
 * - Configurable timeout via AbortController
 * - FormData support (skips body transform + Content-Type)
 */

import camelcaseKeys from 'camelcase-keys'
import snakecaseKeys from 'snakecase-keys'
import { getClientAccessToken, clearTokenCache } from '@/lib/auth/client'
import { getApiBaseUrl } from '@/lib/api-config'
import { AuthError, NetworkError, createErrorFromResponse } from '@/lib/error-utils'

const DEFAULT_TIMEOUT_MS = 30_000
const UPLOAD_TIMEOUT_MS = 60_000

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  skipAuth?: boolean
  skipCaseConversion?: boolean
}

/**
 * Strip trailing slash from endpoint path.
 * Preserves query strings.
 */
function normalizeEndpoint(endpoint: string): string {
  const [path, query] = endpoint.split('?')
  const normalized = path.endsWith('/') ? path.slice(0, -1) : path
  return query ? `${normalized}?${query}` : normalized
}

/**
 * Build full URL with query params
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const base = getApiBaseUrl()
  const normalized = normalizeEndpoint(endpoint)
  const url = new URL(`${base}${normalized}`)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url.toString()
}

/**
 * Core request handler. Handles auth, case conversion, timeout, and 401 retry.
 */
async function request<T>(
  method: HttpMethod,
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const {
    params,
    headers: extraHeaders = {},
    timeout = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    skipAuth = false,
    skipCaseConversion = false,
  } = options

  const url = buildUrl(endpoint, params)

  async function execute(retrying: boolean): Promise<T> {
    // Get auth token
    let token: string | null = null
    if (!skipAuth) {
      token = await getClientAccessToken()
      if (!token) {
        throw new AuthError('Authentication required. Please log in.')
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Transform body (camelCase → snake_case)
    let serializedBody: string | undefined
    if (body !== undefined && method !== 'DELETE') {
      const transformed = skipCaseConversion
        ? body
        : snakecaseKeys(body as Record<string, unknown>, { deep: true })
      serializedBody = JSON.stringify(transformed)
    }

    // Timeout via AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // Combine external signal if provided
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort())
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: serializedBody,
        signal: controller.signal,
      })

      // 401 retry: clear cache, re-fetch token, try once more
      if (response.status === 401 && !retrying && !skipAuth) {
        clearTokenCache()
        return execute(true)
      }

      if (!response.ok) {
        throw await createErrorFromResponse(response)
      }

      // Parse response
      const text = await response.text()
      if (!text) return null as T

      try {
        const data = JSON.parse(text)
        if (skipCaseConversion) return data as T
        return camelcaseKeys(data, { deep: true }) as T
      } catch {
        return text as unknown as T
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timed out. Please try again.')
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError()
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return execute(false)
}

/**
 * Upload handler for FormData. Skips Content-Type (browser sets multipart boundary)
 * and skips body case conversion.
 */
async function upload<T>(
  endpoint: string,
  formData: FormData,
  options: RequestOptions & { method?: 'POST' | 'PUT' } = {},
): Promise<T> {
  const {
    method = 'POST',
    params,
    headers: extraHeaders = {},
    timeout = UPLOAD_TIMEOUT_MS,
    signal: externalSignal,
    skipAuth = false,
  } = options

  const url = buildUrl(endpoint, params)

  async function execute(retrying: boolean): Promise<T> {
    let token: string | null = null
    if (!skipAuth) {
      token = await getClientAccessToken()
      if (!token) {
        throw new AuthError('Authentication required. Please log in.')
      }
    }

    // No Content-Type — browser sets it with multipart boundary
    const headers: Record<string, string> = { ...extraHeaders }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort())
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: formData,
        signal: controller.signal,
      })

      if (response.status === 401 && !retrying && !skipAuth) {
        clearTokenCache()
        return execute(true)
      }

      if (!response.ok) {
        throw await createErrorFromResponse(response)
      }

      const text = await response.text()
      if (!text) return null as T

      try {
        const data = JSON.parse(text)
        return camelcaseKeys(data, { deep: true }) as T
      } catch {
        return text as unknown as T
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timed out. Please try again.')
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError()
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return execute(false)
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>('GET', endpoint, undefined, options),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', endpoint, body, options),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', endpoint, body, options),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', endpoint, body, options),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>('DELETE', endpoint, undefined, options),

  upload: <T>(endpoint: string, formData: FormData, options?: RequestOptions & { method?: 'POST' | 'PUT' }) =>
    upload<T>(endpoint, formData, options),
}
