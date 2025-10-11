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
        .select('role, is_active')
        .eq('auth_user_id', data.user.id)
        .single()

      if (userError) throw new Error('User profile not found')

      if (!userData.is_active) {
        await supabase.auth.signOut()
        throw new Error('Your account has been deactivated')
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex w-full max-w-3xl rounded-2xl shadow-lg overflow-hidden">
        {/* Left: Form */}
        <div className="w-3/5 bg-white p-10 flex flex-col justify-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Log In</h2>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-semibold mb-1 text-gray-800" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 bg-white"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-gray-800" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 bg-white"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
            )}
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-indigo-500 text-white font-semibold text-lg hover:bg-indigo-600 transition disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="w-full py-2 rounded-lg border border-gray-400 text-gray-800 font-semibold hover:bg-gray-100 transition"
              onClick={() => router.push('/reset-password')}
            >
              Forgot Password?
            </button>
            {activeTab === 'admin' && (
              <button
                type="button"
                className="w-full py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                onClick={() => router.push('/register')}
              >
                Create Admin Account
              </button>
            )}
          </form>
        </div>
        {/* Right: Logo/Brand */}
        <div className="w-2/5 bg-[#23233a] flex items-center justify-center">
          <span className="text-5xl font-extrabold text-indigo-400 select-none">AgentView</span>
        </div>
      </div>
    </div>
  )
}
