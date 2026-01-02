'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useAgencyBranding } from "@/contexts/AgencyBrandingContext"
import { useTheme } from "next-themes"
import { useNotification } from '@/contexts/notification-context'
import { decodeAndValidateJwt } from '@/lib/auth/jwt'
import { supabaseRestFetch, updatePassword } from '@/lib/supabase/api'
import { AUTH_TIMEOUT_MS, getInviteTokens, clearInviteTokens } from '@/lib/auth/constants'

interface UserData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  role: 'admin' | 'agent' | 'client'
  perm_level: string
  is_admin: boolean
  status: 'pre-invite' | 'invited' | 'onboarding' | 'active' | 'inactive'
  agency_id?: string
}

interface AgencyData {
  display_name: string
  name: string
}

export default function SetupAccount() {
  const supabase = createClient()
  const { showSuccess } = useNotification()
  const router = useRouter()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const { setTheme } = useTheme()

  const [userData, setUserData] = useState<UserData | null>(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    password: "",
    confirmPassword: ""
  })

  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [agencyName, setAgencyName] = useState<string>("AgentSpace")
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!brandingLoading) {
      if (isWhiteLabel && branding?.theme_mode) {
        setTheme(branding.theme_mode)
      } else {
        setTheme('light')
      }
    }
  }, [isWhiteLabel, branding, brandingLoading, setTheme])

  useEffect(() => {
    fetchUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [errors])

  const fetchUserData = async () => {
    try {
      const { accessToken: storedAccessToken } = getInviteTokens()
      let authUserId: string | null = null

      // Check stored tokens first (avoids getUser() which can hang)
      if (storedAccessToken) {
        const payload = decodeAndValidateJwt(storedAccessToken)
        if (!payload) {
          clearInviteTokens()
          router.push('/login?error=Your session has expired. Please use your invitation link again.')
          return
        }
        authUserId = payload.sub
      }

      // Fallback to session check with timeout
      if (!authUserId) {
        try {
          const getUserPromise = supabase.auth.getUser()
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), AUTH_TIMEOUT_MS)
          )
          const result = await Promise.race([getUserPromise, timeoutPromise])
          if (result?.data?.user) {
            authUserId = result.data.user.id
          }
        } catch {
          // Timeout or error, continue to redirect
        }
      }

      if (!authUserId) {
        router.push('/login')
        return
      }

      // Fetch user data
      let userRecord: UserData | null = null

      if (storedAccessToken) {
        const { data } = await supabaseRestFetch<UserData[]>(
          `/rest/v1/users?auth_user_id=eq.${authUserId}&status=eq.onboarding&select=*`,
          { accessToken: storedAccessToken }
        )
        userRecord = data?.[0] || null
      } else {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', authUserId)
          .eq('status', 'onboarding')
          .single()
        userRecord = data
      }

      if (!userRecord) {
        setErrors(['Failed to load user data. Your account setup may have already been completed.'])
        setLoading(false)
        return
      }

      setUserData(userRecord)
      setFormData({
        firstName: userRecord.first_name || "",
        lastName: userRecord.last_name || "",
        phoneNumber: userRecord.phone_number || "",
        password: "",
        confirmPassword: ""
      })

      // Fetch agency data
      if (userRecord.agency_id) {
        let agencyData: AgencyData | null = null

        if (storedAccessToken) {
          const { data } = await supabaseRestFetch<AgencyData[]>(
            `/rest/v1/agencies?id=eq.${userRecord.agency_id}&select=display_name,name`,
            { accessToken: storedAccessToken }
          )
          agencyData = data?.[0] || null
        } else {
          const { data } = await supabase
            .from('agencies')
            .select('display_name, name')
            .eq('id', userRecord.agency_id)
            .maybeSingle()
          agencyData = data
        }

        if (agencyData) {
          setAgencyName(agencyData.display_name || agencyData.name || "AgentSpace")
        }
      }
    } catch {
      setErrors(['Failed to load user data'])
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    if (!formData.phoneNumber || formData.phoneNumber.trim() === '') {
      newErrors.push("Phone number is required")
      newErrorFields.phoneNumber = "Required"
    } else if (formData.phoneNumber.length !== 10) {
      newErrors.push("Phone number must be 10 digits")
      newErrorFields.phoneNumber = "Invalid phone format"
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

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    if (errorFields[field]) {
      setErrorFields({ ...errorFields, [field]: '' })
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
      let accessToken = getInviteTokens().accessToken

      if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession()
        accessToken = session?.access_token || null
      }

      if (!accessToken) {
        setErrors(['Authentication error. Please try logging in again.'])
        return
      }

      // Update password
      const passwordResult = await updatePassword(accessToken, formData.password)
      if (!passwordResult.success) {
        setErrors([passwordResult.error || 'Failed to update password. Please try again.'])
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Update profile
      const updateData: Record<string, unknown> = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber || null,
        updated_at: new Date().toISOString(),
      }

      if (userData?.role === 'client') {
        updateData.status = 'active'
      }

      const { error: profileError } = await supabaseRestFetch(
        `/rest/v1/users?id=eq.${userData?.id}`,
        { accessToken, method: 'PATCH', body: updateData }
      )

      if (profileError) {
        setErrors(['Failed to update profile. Please try again.'])
        return
      }

      setFormData({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        password: "",
        confirmPassword: ""
      })

      clearInviteTokens()

      showSuccess('Account setup complete! Please log in with your new password.')
      router.push('/login?message=setup-complete')
    } catch {
      setErrors(['Failed to complete setup. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Failed to load user data</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-foreground" style={{ fontFamily: 'Times New Roman, serif' }}>
            Welcome to {agencyName}
          </h1>
          <p className="text-muted-foreground">
            Set up your password to get started
          </p>
        </div>

        {errors.length > 0 && (
          <div
            ref={errorRef}
            className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/30"
          >
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        )}

        <div className="bg-card rounded-xl shadow-lg border border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-2xl font-bold text-foreground">Account Information</h2>
              <p className="text-sm text-muted-foreground mt-1">Confirm your information and set up your password</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  First name <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  Last name <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="h-12"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Email
              </label>
              <Input
                type="email"
                value={userData.email}
                className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                readOnly
              />
              <p className="text-xs text-muted-foreground">Contact admin to change email</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Phone number <span className="text-destructive">*</span>
              </label>
              <Input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                className={`h-12 ${errorFields.phoneNumber ? 'border-red-500' : ''}`}
                placeholder="1234567890"
                required
              />
              {errorFields.phoneNumber && (
                <p className="text-red-500 text-sm">{errorFields.phoneNumber}</p>
              )}
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Set Up Password</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Password <span className="text-destructive">*</span>
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
                  <label className="block text-sm font-semibold text-foreground">
                    Confirm Password <span className="text-destructive">*</span>
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
            </div>

            <div className="pt-6">
              <Button
                type="submit"
                className="w-full py-3 bg-black hover:bg-black/90 text-white font-semibold text-lg disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-3">
                You'll complete additional setup steps after logging in
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
