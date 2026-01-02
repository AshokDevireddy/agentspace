export interface JwtPayload {
  sub: string
  email?: string
  exp: number
  iat: number
  aud: string
  iss: string
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1]))
  } catch {
    return null
  }
}

export function isTokenExpired(payload: JwtPayload): boolean {
  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

export function decodeAndValidateJwt(token: string): JwtPayload | null {
  const payload = decodeJwt(token)
  if (!payload) return null
  if (isTokenExpired(payload)) return null
  return payload
}
