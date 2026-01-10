'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAgencyBranding } from "@/contexts/AgencyBrandingContext"
import { useTheme } from "next-themes"
import { useResetPassword } from '@/hooks/mutations'

export default function ResetPassword() {
  const router = useRouter()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const { setTheme } = useTheme()

  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Use TanStack Query mutation for password reset
  const resetPasswordMutation = useResetPassword()

  // Force light mode for non-white-labeled sites, use agency theme for white-labeled sites
  useEffect(() => {
    if (!brandingLoading) {
      if (isWhiteLabel && branding?.theme_mode) {
        setTheme(branding.theme_mode)
      } else {
        setTheme('light')
      }
    }
  }, [isWhiteLabel, branding, brandingLoading, setTheme])

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Intentionally avoid pre-checking if the email exists to prevent account enumeration
  // and to allow invited (but not yet onboarded) users to request a reset.

  const showSuccessAndRedirect = () => {
    // Always show success message to prevent email enumeration
    setMessage({ type: 'success', text: 'If an account exists for this email, a reset link has been sent. Check your inbox.' })
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      setTimeout(() => {
        setMessage(null)
      }, 3000)
      return
    }

    setMessage(null)

    resetPasswordMutation.mutate(
      { email },
      {
        onSuccess: showSuccessAndRedirect,
        onError: (error) => {
          console.error('Error in password reset:', error)
          // Even on error, show generic success message to prevent email enumeration
          showSuccessAndRedirect()
        },
      }
    )
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-card shadow-lg rounded-md p-8 border border-border">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Reset Password</h1>
            <p className="text-muted-foreground">Insert your email to receive a link to reset your password</p>
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
              <label className="block text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                placeholder="Enter your email address"
                required
                disabled={resetPasswordMutation.isPending}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-md disabled:opacity-50"
            >
              {resetPasswordMutation.isPending ? 'Sending...' : 'Send Password Reset Email'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
