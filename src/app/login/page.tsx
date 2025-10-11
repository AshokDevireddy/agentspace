"use client"

import { useState } from "react"
import { useAuth } from "@/providers/AuthProvider"

export default function LoginPage() {
  const { signIn, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message || "Login failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex w-full max-w-2xl rounded-2xl shadow-lg overflow-hidden">
        {/* Left: Form */}
        <div className="w-1/2 bg-white p-10 flex flex-col justify-center">
          <h2 className="text-3xl font-bold mb-8 text-gray-900">Log In</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-semibold mb-1 text-gray-800" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 bg-white"
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
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 bg-white"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-indigo-500 text-white font-semibold text-lg hover:bg-indigo-600 transition disabled:opacity-60"
              disabled={submitting || loading}
            >
              Submit
            </button>
            <button
              type="button"
              className="w-full py-2 rounded-lg border border-gray-400 text-gray-800 font-semibold text-lg hover:bg-gray-100 transition"
              onClick={() => window.location.href = '/reset-password'}
            >
              Forgot Password?
            </button>
          </form>
        </div>
        {/* Right: Logo/Brand */}
        <div className="w-1/2 bg-[#23233a] flex items-center justify-center">
          <span className="text-5xl font-extrabold text-indigo-400 select-none">AgentView</span>
        </div>
      </div>
    </div>
  )
}
