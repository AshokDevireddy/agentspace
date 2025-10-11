'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ForgotPassword() {
  const supabase = createClient()
  const router = useRouter()

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  })
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userEmail, setUserEmail] = useState<string>("")
  const [tokenValid, setTokenValid] = useState<boolean>(false)

  useEffect(() => {
    console.log('=== FORGOT PASSWORD: useEffect started ===')
    console.log('Current URL:', window.location.href)
    console.log('URL search params:', window.location.search)
    console.log('URL hash:', window.location.hash)

    // Try to exchange any auth code in the URL for a session (PKCE / OTP flows)
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ data, error }) => {
      console.log('exchangeCodeForSession result:', { hasSession: !!data?.session, error })
    }).catch((e) => {
      console.log('exchangeCodeForSession threw:', e)
    })

    // Listen for auth state changes, specifically PASSWORD_RECOVERY events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('=== FORGOT PASSWORD: Auth state change detected ===')
        console.log('Auth event:', event)
        console.log('Session exists:', !!session)
        console.log('Session user:', session?.user)
        console.log('Session user email:', session?.user?.email)
        console.log('Session access token exists:', !!session?.access_token)
        console.log('Session refresh token exists:', !!session?.refresh_token)

        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          console.log('=== PASSWORD_RECOVERY event triggered ===')
          // User has clicked the password recovery link and is now authenticated
          if (session?.user?.email) {
            console.log('Setting user email:', session.user.email)
            setUserEmail(session.user.email)
            setTokenValid(true)
            setLoading(false)
          } else {
            console.error('No user email found in session during PASSWORD_RECOVERY')
            setLoading(false)
            setTimeout(() => {
              router.push('/login')
            }, 3000)
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('=== SIGNED_OUT event triggered ===')
          // User signed out, redirect to login
          router.push('/login')
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('=== TOKEN_REFRESHED event triggered ===')
          // Check if we have a valid session with user data
          const { data: { user } } = await supabase.auth.getUser()
          console.log('getUser result:', user)
          if (user?.email) {
            console.log('Setting user email from TOKEN_REFRESHED:', user.email)
            setUserEmail(user.email)
            setTokenValid(true)
            setLoading(false)
          } else {
            console.log('No user found during TOKEN_REFRESHED')
            setLoading(false)
            setTimeout(() => {
              router.push('/login')
            }, 3000)
          }
        } else {
          console.log('=== Other auth event detected ===')
          console.log('Event type:', event)
          console.log('This event is not handled specifically')
        }
      }
    )

    // Check if user is already authenticated (in case they refresh the page)
    const checkCurrentSession = async () => {
      console.log('=== FORGOT PASSWORD: Checking current session ===')
      const { data: { user }, error } = await supabase.auth.getUser()
      console.log('checkCurrentSession - getUser result:', user)
      console.log('checkCurrentSession - getUser error:', error)

      if (user?.email) {
        console.log('User already authenticated, setting email:', user.email)
        setUserEmail(user.email)
        setTokenValid(true)
        setLoading(false)
      } else {
        console.log('No authenticated user found in current session')
        // No valid session, redirect to login after a delay
        setLoading(false)
        // Do not redirect immediately; allow user to see the error UI
      }
    }

    checkCurrentSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase.auth])

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Check if passwords are filled out
    if (!formData.password.trim()) {
      newErrors.push("Password is required")
      newErrorFields.password = "Password is required"
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.push("Confirm password is required")
      newErrorFields.confirmPassword = "Confirm password is required"
    }

    // Password validation
    if (formData.password.length < 6) {
      newErrors.push("Password must be at least 6 characters")
      newErrorFields.password = "Password too short"
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.push("Passwords do not match")
      newErrorFields.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    setErrorFields(newErrorFields)
    return newErrors.length === 0
  }

  const updatePassword = async (new_password: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: new_password
      })

      if (error) {
        throw error
      }

      return true
    } catch (error) {
      console.error('Error updating password:', error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)

    try {
      // Update password securely through Supabase Auth
      // User is already authenticated from PASSWORD_RECOVERY event
      const passwordUpdated = await updatePassword(formData.password)

      if (!passwordUpdated) {
        setErrors(['Failed to update password. Please try again.'])
        return
      }

      // Clear sensitive data from memory
      setFormData({
        password: "",
        confirmPassword: ""
      })

      // Redirect to login page with success message
      router.push('/login?message=password-reset-success')
    } catch (error) {
      console.error('Error updating password:', error)
      setErrors(['Failed to update password. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    // Clear error for this field when user starts typing
    if (errorFields[field]) {
      setErrorFields({ ...errorFields, [field]: '' })
    }
  }

  // Group errors by type for better display
  const passwordErrors = errors.filter(error => error.includes('Password') || error.includes('match'))
  const otherErrors = errors.filter(error => !error.includes('Password') && !error.includes('match'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!userEmail || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-2">Error: Forgot Password Link Invalid</div>
          <div className="text-sm text-gray-600">Please Reset Password Again or Login</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
            <p className="text-gray-600">Enter a new password for {userEmail}</p>
          </div>

          {/* Password Errors */}
          {passwordErrors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {passwordErrors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Other Errors */}
          {otherErrors.length > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {otherErrors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email - Locked */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-900">
                Email
              </label>
              <Input
                type="email"
                value={userEmail}
                className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>

            {/* Password Setup Section */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Set New Password</h3>

              {/* Password */}
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-gray-900">
                  Password
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className={`h-12 ${errorFields.password ? 'border-red-500' : ''}`}
                  placeholder="Enter your password"
                  required
                />
                {errorFields.password && (
                  <p className="text-red-500 text-sm">{errorFields.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className={`h-12 ${errorFields.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="Confirm your password"
                  required
                />
                {errorFields.confirmPassword && (
                  <p className="text-red-500 text-sm">{errorFields.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Resetting password...' : 'Reset Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

