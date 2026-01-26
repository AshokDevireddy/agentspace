'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { decodeAndValidateJwt } from '@/lib/auth/jwt'
import { captureHashTokens } from '@/lib/auth/constants'
import { authApi, AuthApiError } from '@/lib/api/auth'

export default function ForgotPassword() {
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

  // Capture tokens immediately on component mount - store in ref to survive re-renders
  const initialHashTokensRef = useRef<ReturnType<typeof captureHashTokens>>(null)
  if (initialHashTokensRef.current === null) {
    initialHashTokensRef.current = captureHashTokens('recovery')
    console.log('[ForgotPassword] Captured hash tokens on mount:', !!initialHashTokensRef.current)
  }
  const initialHashTokens = initialHashTokensRef.current

  const processingRef = useRef(false)

  useEffect(() => {
    if (processingRef.current) return
    processingRef.current = true

    handleRecovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRecovery = async () => {
    console.log('[ForgotPassword] handleRecovery called, initialHashTokens:', !!initialHashTokens)

    if (initialHashTokens) {
      const payload = decodeAndValidateJwt(initialHashTokens.accessToken)
      console.log('[ForgotPassword] JWT payload:', payload)

      if (!payload) {
        console.log('[ForgotPassword] Invalid JWT, redirecting to login')
        setLoading(false)
        router.push('/login?error=Your password reset link has expired. Please request a new one.')
        return
      }

      if (payload.email) {
        console.log('[ForgotPassword] Valid recovery token for email:', payload.email)
        // DON'T store in localStorage - keep in ref only
        // This way it survives the session and works across devices

        setUserEmail(payload.email)
        setTokenValid(true)
        setLoading(false)
        return
      }
    }

    console.log('[ForgotPassword] No valid tokens found, redirecting to login')
    setLoading(false)
    router.push('/login?error=Please use the password reset link from your email')
  }

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    if (!formData.password.trim()) {
      newErrors.push("Password is required")
      newErrorFields.password = "Password is required"
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.push("Confirm password is required")
      newErrorFields.confirmPassword = "Confirm password is required"
    }

    if (formData.password.length < 6) {
      newErrors.push("Password must be at least 6 characters")
      newErrorFields.password = "Password too short"
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.push("Passwords do not match")
      newErrorFields.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    setErrorFields(newErrorFields)
    return newErrors.length === 0
  }

  const handleUpdatePassword = async (newPassword: string) => {
    console.log('[ForgotPassword] handleUpdatePassword called')

    // Use tokens from ref directly - don't rely on localStorage
    if (!initialHashTokens?.accessToken) {
      console.error('[ForgotPassword] No recovery token found in component state')
      return {
        success: false,
        message: 'No recovery token found. Please use the password reset link again.'
      }
    }

    console.log('[ForgotPassword] Using recovery token from URL hash')
    console.log('[ForgotPassword] Calling resetPassword API')

    try {
      await authApi.resetPassword({
        access_token: initialHashTokens.accessToken,
        password: newPassword,
      })
      console.log('[ForgotPassword] resetPassword succeeded')
      return { success: true }
    } catch (err) {
      console.log('[ForgotPassword] resetPassword failed:', err)
      const message = err instanceof AuthApiError ? err.message : 'Failed to reset password'
      return { success: false, message }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setErrors([])

    try {
      const result = await handleUpdatePassword(formData.password)

      if (!result.success) {
        setErrors([result.message || 'Failed to update password. Please try again.'])
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Password updated successfully - clear form
      setFormData({ password: "", confirmPassword: "" })
      console.log('[ForgotPassword] Password reset successful, preparing redirect...')

      // Get redirect URL from query params
      const urlParams = new URLSearchParams(window.location.search)
      const whitelabelDomain = urlParams.get('whitelabel_domain')
      let redirectUrl = '/login?message=password-reset-success'

      if (whitelabelDomain) {
        const protocol = window.location.protocol
        redirectUrl = `${protocol}//${whitelabelDomain}/login?message=password-reset-success`
        console.log('[ForgotPassword] Using whitelabel domain:', whitelabelDomain)
      }

      console.log('[ForgotPassword] Redirecting to:', redirectUrl)

      // Navigate immediately - don't wait for signOut
      // The login page will clear session anyway
      window.location.href = redirectUrl
    } catch (err) {
      console.error('Password reset error:', err)
      setErrors(['Failed to update password. Please try again.'])
      setSubmitting(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    if (errorFields[field]) {
      setErrorFields({ ...errorFields, [field]: '' })
    }
  }

  const passwordErrors = errors.filter(error => error.includes('Password') || error.includes('match'))
  const otherErrors = errors.filter(error => !error.includes('Password') && !error.includes('match'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    )
  }

  if (!userEmail || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-2">Error: Forgot Password Link Invalid</div>
          <div className="text-sm text-muted-foreground">Please Reset Password Again or Login</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card shadow-lg rounded-md p-8 border border-border">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Reset Password</h1>
            <p className="text-muted-foreground">Enter a new password for {userEmail}</p>
          </div>

          {passwordErrors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {passwordErrors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                type="email"
                value={userEmail}
                className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-medium text-foreground mb-4">Set New Password</h3>

              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-foreground">
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
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

            <div className="pt-6">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-md disabled:opacity-50"
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
