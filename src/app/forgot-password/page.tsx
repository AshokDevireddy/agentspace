'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { decodeAndValidateJwt } from '@/lib/auth/jwt'
import { updatePassword } from '@/lib/supabase/api'
import { storeRecoveryTokens, getRecoveryTokens, clearRecoveryTokens, captureHashTokens } from '@/lib/auth/constants'

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

  const [initialHashTokens] = useState(() => captureHashTokens('recovery'))
  const processingRef = useRef(false)

  useEffect(() => {
    if (processingRef.current) return
    processingRef.current = true

    handleRecovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRecovery = async () => {
    if (initialHashTokens) {
      const payload = decodeAndValidateJwt(initialHashTokens.accessToken)

      if (!payload) {
        setLoading(false)
        router.push('/login?error=Your password reset link has expired. Please request a new one.')
        return
      }

      if (payload.email) {
        storeRecoveryTokens(initialHashTokens.accessToken, initialHashTokens.refreshToken)
        setUserEmail(payload.email)
        setTokenValid(true)
        setLoading(false)
        return
      }
    }

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
    const { accessToken } = getRecoveryTokens()

    if (!accessToken) {
      return {
        success: false,
        message: 'No recovery token found. Please use the password reset link again.'
      }
    }

    const result = await updatePassword(accessToken, newPassword)

    if (result.success) {
      clearRecoveryTokens()
    }

    return {
      success: result.success,
      message: result.error || undefined
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
      const result = await handleUpdatePassword(formData.password)

      if (!result.success) {
        setErrors([result.message || 'Failed to update password. Please try again.'])
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      setFormData({ password: "", confirmPassword: "" })

      const urlParams = new URLSearchParams(window.location.search)
      const agencyId = urlParams.get('agency_id')

      if (agencyId) {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('whitelabel_domain')
          .eq('id', agencyId)
          .single()

        if (agencyData?.whitelabel_domain) {
          const protocol = window.location.protocol
          window.location.href = `${protocol}//${agencyData.whitelabel_domain}/login?message=password-reset-success`
          return
        }
      }

      router.push('/login?message=password-reset-success')
    } catch {
      setErrors(['Failed to update password. Please try again.'])
    } finally {
      setSubmitting(false)
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
