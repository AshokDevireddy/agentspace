import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)

export interface SessionPayload {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Creates a new session by storing encrypted session data in an httpOnly cookie.
 * The session contains the user's ID and tokens from Django backend.
 */
export async function createSession(data: {
  userId: string
  accessToken: string
  refreshToken: string
}): Promise<void> {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days

  const session = await new SignJWT({ ...data, expiresAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(expiresAt),
    path: '/',
  })
}

/**
 * Retrieves and validates the current session from the httpOnly cookie.
 * Returns null if no session exists or if the session is invalid/expired.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) return null

  try {
    const { payload } = await jwtVerify(sessionCookie, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/**
 * Deletes the session cookie, effectively logging out the user.
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

/**
 * Convenience function to get the access token from the current session.
 * Returns null if no valid session exists.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.accessToken ?? null
}

/**
 * Convenience function to get the refresh token from the current session.
 * Returns null if no valid session exists.
 */
export async function getRefreshToken(): Promise<string | null> {
  const session = await getSession()
  return session?.refreshToken ?? null
}

/**
 * Updates an existing session with new tokens.
 * Used when the access token is refreshed.
 */
export async function updateSession(data: {
  accessToken: string
  refreshToken: string
}): Promise<void> {
  const currentSession = await getSession()
  if (!currentSession) {
    throw new Error('No session to update')
  }

  await createSession({
    userId: currentSession.userId,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  })
}
