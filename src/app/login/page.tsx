"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type UserRole = 'admin' | 'agent' | 'client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<UserRole>('agent')
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isProcessingInvite, setIsProcessingInvite] = useState(false)

  // Handle invite tokens in URL hash
  useEffect(() => {
    const handleInviteToken = async () => {
      // Check if we have invite tokens in the URL hash
      const hash = window.location.hash.substring(1)
      if (!hash) return

      const params = new URLSearchParams(hash)
      const error = params.get('error')
      const errorDescription = params.get('error_description')
      const type = params.get('type')
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      // Handle errors from Supabase (expired links, etc.)
      if (error) {
        console.error('Auth error from URL:', error, errorDescription)

        let errorMessage = 'An error occurred with your invite link.'

        if (error === 'access_denied' && errorDescription?.includes('expired')) {
          errorMessage = 'Your invite link has expired. Please contact your administrator to resend the invitation.'
        } else if (error === 'access_denied' && errorDescription?.includes('invalid')) {
          errorMessage = 'Your invite link is invalid. Please contact your administrator to resend the invitation.'
        } else if (errorDescription) {
          errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        }

        setError(errorMessage)
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname)
        return
      }

      // If this is an invite link
      if (type === 'invite' && (accessToken || refreshToken)) {
        setIsProcessingInvite(true)
        console.log('Processing invite token from URL hash')

        try {
          // Manually set the session from the hash tokens
          const { data: { session }, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken!,
            refresh_token: refreshToken!
          })

          if (setSessionError || !session) {
            console.error('Error setting session from invite tokens:', setSessionError)
            setError('Failed to process invite. Please try clicking the link again.')
            setIsProcessingInvite(false)
            // Clear the hash
            window.history.replaceState(null, '', window.location.pathname)
            return
          }

          const user = session.user
          console.log('Session established for user:', user.id)

          // Get user profile to determine where to route them
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('id, role, status')
            .eq('auth_user_id', user.id)
            .maybeSingle()

          if (profileError || !userProfile) {
            console.error('User profile not found:', profileError)
            setError('Account not found. Please contact support.')
            setIsProcessingInvite(false)
            window.history.replaceState(null, '', window.location.pathname)
            return
          }

          // Handle user based on their status
          if (userProfile.status === 'invited') {
            // First time clicking invite link - transition to onboarding
            console.log('Transitioning user from invited to onboarding')
            const { error: updateError } = await supabase
              .from('users')
              .update({ status: 'onboarding', updated_at: new Date().toISOString() })
              .eq('id', userProfile.id)

            if (updateError) {
              console.error('Error updating user status:', updateError)
              // Continue anyway, they can still proceed to setup
            }

            window.location.href = '/setup-account'
            return
          }

          if (userProfile.status === 'onboarding') {
            // User clicked link again but hasn't finished onboarding
            window.location.href = '/setup-account'
            return
          }

          if (userProfile.status === 'active') {
            // User already set up, route to appropriate dashboard
            if (userProfile.role === 'client') {
              window.location.href = '/client/dashboard'
            } else {
              window.location.href = '/'
            }
            return
          }

          // Handle inactive or other statuses
          console.error('User has invalid status:', userProfile.status)
          setError('Account is not accessible. Please contact support.')
          setIsProcessingInvite(false)
          window.history.replaceState(null, '', window.location.pathname)

        } catch (err: any) {
          console.error('Error processing invite:', err)
          setError(err.message || 'Failed to process invite')
          setIsProcessingInvite(false)
          window.history.replaceState(null, '', window.location.pathname)
        }
      }
    }

    handleInviteToken()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Get user profile to check role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, status')
        .eq('auth_user_id', data.user.id)
        .single()

      if (userError) throw new Error('User profile not found')

      // Handle different user statuses
      if (userData.status === 'invited') {
        await supabase.auth.signOut()
        throw new Error('Please check your email and click the invite link to complete account setup')
      }

      if (userData.status === 'onboarding') {
        // User has set password but hasn't completed Phase 2 onboarding
        // Redirect to dashboard where onboarding wizard will show
        if (userData.role === 'client') {
          window.location.href = '/client/dashboard'
        } else {
          window.location.href = '/'
        }
        return
      }

      if (userData.status === 'inactive') {
        await supabase.auth.signOut()
        throw new Error('Your account has been deactivated')
      }

      if (userData.status !== 'active') {
        await supabase.auth.signOut()
        throw new Error('Account status is invalid. Please contact support.')
      }

      // Verify user is logging in with correct tab
      if (userData.role !== activeTab) {
        await supabase.auth.signOut()
        throw new Error(`Please use the ${userData.role} login tab`)
      }

      // Route based on role
      // Use window.location.href to force a full page reload with the new auth state
      // This ensures cookies are properly set before the redirect on Vercel
      if (userData.role === 'client') {
        window.location.href = '/client/dashboard'
      } else {
        window.location.href = '/'
      }
    } catch (err: any) {
      setError(err.message || "Login failed")
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: { value: UserRole; label: string }[] = [
    { value: 'agent', label: 'Agent' },
    { value: 'admin', label: 'Admin' },
    { value: 'client', label: 'Client' },
  ]

  // Show loading state while processing invite
  if (isProcessingInvite) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-lg text-foreground">Processing your invitation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex w-full max-w-3xl rounded-md shadow-lg overflow-hidden border border-border">
        {/* Left: Form */}
        <div className="w-3/5 bg-card p-10 flex flex-col justify-center">
          <h2 className="text-3xl font-bold mb-6 text-foreground">Log In</h2>

          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'border-b-2 border-foreground text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="w-full py-2 rounded-md border border-border text-foreground font-semibold hover:bg-accent transition"
              onClick={() => router.push('/reset-password')}
            >
              Forgot Password?
            </button>
            {activeTab === 'admin' && (
              <button
                type="button"
                className="w-full py-2 rounded-md bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition"
                onClick={() => router.push('/register')}
              >
                Create Admin Account
              </button>
            )}
          </form>
        </div>
        {/* Right: Logo/Brand */}
        <div className="w-2/5 bg-foreground flex items-center justify-center">
          <span className="text-5xl font-extrabold text-background select-none" style={{ fontFamily: 'Times New Roman, serif' }}>AgentSpace</span>
        </div>
      </div>
    </div>
  )
}
