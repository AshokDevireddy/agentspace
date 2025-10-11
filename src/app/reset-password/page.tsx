'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ResetPassword() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Intentionally avoid pre-checking if the email exists to prevent account enumeration
  // and to allow invited (but not yet onboarded) users to request a reset.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      setTimeout(() => {
        setMessage(null)
      }, 3000)
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      })

      if (error) {
        console.error('Error sending reset email:', error)
      }

      // Always show success message to prevent email enumeration
      setMessage({ type: 'success', text: 'If an account exists for this email, a reset link has been sent. Check your inbox.' })
      setTimeout(() => {
        router.push('/login')
      }, 3000)

    } catch (error) {
      console.error('Error in password reset:', error)
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' })
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
            <p className="text-gray-600">Insert your email to receive a link to reset your password</p>
          </div>

          {/* Success/Error Messages */}
          {message && (
            <Alert variant={message.type === 'success' ? 'default' : 'destructive'} className="mb-6">
              <AlertDescription>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-900">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                placeholder="Enter your email address"
                required
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Password Reset Email'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
