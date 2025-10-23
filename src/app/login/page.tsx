"use client"

import { useState } from "react"
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
          router.push('/client/dashboard')
        } else {
          router.push('/')
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
      if (userData.role === 'client') {
        router.push('/client/dashboard')
      } else {
        router.push('/')
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

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex w-full max-w-3xl rounded-2xl shadow-lg overflow-hidden border border-border">
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
                    ? 'border-b-2 border-primary text-primary'
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
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="w-full py-2 rounded-lg border border-border text-foreground font-semibold hover:bg-accent transition"
              onClick={() => router.push('/reset-password')}
            >
              Forgot Password?
            </button>
            {activeTab === 'admin' && (
              <button
                type="button"
                className="w-full py-2 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition"
                onClick={() => router.push('/register')}
              >
                Create Admin Account
              </button>
            )}
          </form>
        </div>
        {/* Right: Logo/Brand */}
        <div className="w-2/5 bg-primary flex items-center justify-center">
          <span className="text-5xl font-extrabold text-primary-foreground select-none">AgentSpace</span>
        </div>
      </div>
    </div>
  )
}
