"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAgencyBranding } from "@/contexts/AgencyBrandingContext"
import { useSignIn } from "@/hooks/mutations"

export default function LoginPage() {
  const router = useRouter()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const processedRef = useRef(false)
  const signInMutation = useSignIn()

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const urlParams = new URLSearchParams(window.location.search)
    const queryError = urlParams.get('error')
    const message = urlParams.get('message')

    if (queryError) {
      setError(decodeURIComponent(queryError))
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    if (message === 'password-reset-success' || message === 'setup-complete') {
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    const hash = window.location.hash.substring(1)
    if (hash) {
      const params = new URLSearchParams(hash)
      const urlError = params.get('error')
      const errorDescription = params.get('error_description')

      if (urlError) {
        let errorMessage = 'An error occurred with your link.'

        if (urlError === 'access_denied' && errorDescription?.includes('expired')) {
          errorMessage = 'Your invite link has expired. Please contact your administrator to resend the invitation.'
        } else if (urlError === 'access_denied' && errorDescription?.includes('invalid')) {
          errorMessage = 'Your invite link is invalid. Please contact your administrator to resend the invitation.'
        } else if (errorDescription) {
          errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        }

        setError(errorMessage)
      }

      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    signInMutation.mutate(
      { email, password },
      {
        onSuccess: async (result) => {
          const { user: userData, agency: userAgency } = result

          // Whitelabel validation
          const isLocalhost = typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname.includes('localhost'))

          if (!isLocalhost) {
            if (isWhiteLabel && branding) {
              if (userData.agency_id !== branding.id) {
                signInMutation.reset()
                setError('No account found with these credentials')
                return
              }
            }

            if (!isWhiteLabel && userAgency.whitelabel_domain) {
              signInMutation.reset()
              setError('No account found with these credentials')
              return
            }
          }

          // Status validation
          if (userData.status === 'invited') {
            signInMutation.reset()
            setError('Please check your email and click the invite link to complete account setup')
            return
          }

          if (userData.status === 'inactive') {
            signInMutation.reset()
            setError('Your account has been deactivated')
            return
          }

          if (userData.status !== 'active' && userData.status !== 'onboarding') {
            signInMutation.reset()
            setError('Account status is invalid. Please contact support.')
            return
          }

          // Session is already set by the mutation via native Supabase signInWithPassword
          const destination = userData.role === 'client' ? '/client/dashboard' : '/'
          router.push(destination)
        },
        onError: (err) => {
          setError(err.message || 'Login failed')
        },
      }
    )
  }

  const displayName = isWhiteLabel && branding ? branding.display_name : 'AgentSpace'
  const logoUrl = isWhiteLabel && branding ? branding.logo_url : null

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${displayName} logo`}
            className="h-10 object-contain"
          />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-bold text-foreground">
              {displayName}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center flex-1">
        <div className="flex w-full max-w-3xl rounded-md shadow-lg overflow-hidden border border-border">
          <div className="w-3/5 bg-card p-10 flex flex-col justify-center">
            <h2 className="text-3xl font-bold mb-6 text-foreground">Log In</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1 text-foreground" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-4 py-2 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring text-foreground bg-background"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-foreground" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="w-full px-4 py-2 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring text-foreground bg-background"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</div>
              )}
              <button
                type="submit"
                className="w-full py-2 rounded-md bg-foreground text-background font-semibold text-lg hover:bg-foreground/90 transition disabled:opacity-60"
                disabled={signInMutation.isPending || signInMutation.isSuccess}
              >
                {signInMutation.isPending || signInMutation.isSuccess ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                className="w-full py-2 rounded-md border border-border text-foreground font-semibold hover:bg-accent transition"
                onClick={() => router.push('/reset-password')}
              >
                Forgot Password?
              </button>
              <button
                type="button"
                className="w-full py-2 rounded-md bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition"
                onClick={() => router.push('/register')}
              >
                Create Admin Account
              </button>
            </form>
          </div>
          <div className="w-2/5 bg-foreground flex flex-col items-center justify-center p-6 relative">
            {brandingLoading ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-48 h-48 bg-background/10 rounded-lg animate-pulse" />
              </div>
            ) : (
              <>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${displayName} logo`}
                    className="max-w-[200px] max-h-[200px] object-contain"
                  />
                ) : (
                  <span className="text-5xl font-extrabold text-background select-none text-center" style={{ fontFamily: 'Times New Roman, serif' }}>
                    {displayName}
                  </span>
                )}

                {isWhiteLabel && (
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <p className="text-xs text-background/60">
                      Powered by <span className="font-semibold">AgentSpace</span>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
