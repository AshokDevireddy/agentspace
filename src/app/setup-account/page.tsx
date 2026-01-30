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
import { AUTH_TIMEOUT_MS, getInviteTokens, clearInviteTokens, withTimeout } from '@/lib/auth/constants'
import { authApi, AuthApiError } from '@/lib/api/auth'
import { fetchApi } from '@/lib/api-client'

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

  // Master timeout to prevent infinite loading state
  useEffect(() => {
    if (!loading) {
      console.log(`[setup-account] MASTER TIMEOUT: Skipped (loading=false)`)
      return
    }

    const timeoutStart = Date.now()
    console.log(`[setup-account] MASTER TIMEOUT: Started at ${timeoutStart}, will fire in 15000ms`)

    const masterTimeout = setTimeout(() => {
      console.log(`[setup-account] MASTER TIMEOUT: FIRED at +${Date.now() - timeoutStart}ms, loading=${loading}`)
      if (loading) {
        console.log(`[setup-account] MASTER TIMEOUT: Setting error and loading=false`)
        setErrors(['Loading timed out. Please try using your invitation link again or contact support.'])
        setLoading(false)
      }
    }, 15000)

    return () => {
      console.log(`[setup-account] MASTER TIMEOUT: Cleanup called at +${Date.now() - timeoutStart}ms`)
      clearTimeout(masterTimeout)
    }
  }, [loading])

  const fetchUserData = async () => {
    const startTime = Date.now()
    console.log(`[setup-account] fetchUserData START at ${startTime}`)

    try {
      let authUserId: string | null = null
      let accessToken: string | null = null

      // PRIORITY 1: Check stored invite tokens FIRST (instant - no network call)
      // This is the fast path when coming from /auth/confirm which stores tokens before navigating
      console.log(`[setup-account] PRIORITY 1: Checking stored tokens at +${Date.now() - startTime}ms`)
      const { accessToken: storedAccessToken } = getInviteTokens()
      console.log(`[setup-account] PRIORITY 1: hasStoredToken=${!!storedAccessToken}`)
      if (storedAccessToken) {
        const payload = decodeAndValidateJwt(storedAccessToken)
        console.log(`[setup-account] PRIORITY 1: JWT valid=${!!payload}`)
        if (payload) {
          authUserId = payload.sub
          accessToken = storedAccessToken
          console.log(`[setup-account] PRIORITY 1: Got authUserId from stored token`)
        } else {
          console.log(`[setup-account] PRIORITY 1: Clearing invalid tokens`)
          clearInviteTokens()
        }
      }

      // PRIORITY 2: Try getSession() if no stored tokens (e.g., page refresh after setup)
      if (!authUserId) {
        console.log(`[setup-account] PRIORITY 2: Starting getSession() at +${Date.now() - startTime}ms`)
        try {
          const { data: { session } } = await withTimeout(supabase.auth.getSession())
          console.log(`[setup-account] PRIORITY 2: getSession() completed at +${Date.now() - startTime}ms, hasSession=${!!session?.user}`)
          if (session?.user) {
            authUserId = session.user.id
            accessToken = session.access_token
            console.log(`[setup-account] PRIORITY 2: Got authUserId from session`)
          }
        } catch (sessionError) {
          console.error(`[setup-account] PRIORITY 2: getSession() FAILED at +${Date.now() - startTime}ms:`, sessionError)
        }
      }

      // PRIORITY 3: Try getUser() with timeout as last resort
      if (!authUserId) {
        console.log(`[setup-account] PRIORITY 3: Trying getUser() at +${Date.now() - startTime}ms`)
        try {
          const getUserPromise = supabase.auth.getUser()
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), AUTH_TIMEOUT_MS)
          )
          const result = await Promise.race([getUserPromise, timeoutPromise])
          if (result?.data?.user) {
            authUserId = result.data.user.id
            console.log(`[setup-account] PRIORITY 3: Got authUserId from getUser()`)
          }
        } catch (err) {
          console.log(`[setup-account] PRIORITY 3: getUser() failed at +${Date.now() - startTime}ms:`, err)
        }
      }

      if (!authUserId) {
        console.log(`[setup-account] NO AUTH: Redirecting to login at +${Date.now() - startTime}ms`)
        router.push('/login?error=Session expired. Please use your invitation link again.')
        return
      }

      console.log(`[setup-account] AUTH SUCCESS: Got authUserId at +${Date.now() - startTime}ms`)

      // Fetch user data via Django API
      console.log(`[setup-account] FETCH USER: Starting at +${Date.now() - startTime}ms`)
      let userRecord: UserData | null = null

      if (accessToken) {
        console.log(`[setup-account] FETCH USER: Using Django API with token`)
        try {
          userRecord = await fetchApi<UserData>(
            `/api/users/by-auth-id/${authUserId}/onboarding`,
            accessToken,
            'Failed to load user data'
          )
        } catch {
          userRecord = null
        }
      } else {
        console.log(`[setup-account] FETCH USER: Using Supabase client (fallback)`)
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', authUserId)
          .eq('status', 'onboarding')
          .single()
        userRecord = data
      }

      console.log(`[setup-account] FETCH USER: Completed at +${Date.now() - startTime}ms, hasUser=${!!userRecord}`)

      if (!userRecord) {
        console.log(`[setup-account] FETCH USER: No user found, setting error`)
        setErrors(['Failed to load user data. Your account setup may have already been completed.'])
        setLoading(false)
        return
      }

      console.log(`[setup-account] SUCCESS: Setting user data at +${Date.now() - startTime}ms`)
      setUserData(userRecord)
      setFormData({
        firstName: userRecord.first_name || "",
        lastName: userRecord.last_name || "",
        phoneNumber: userRecord.phone_number || "",
        password: "",
        confirmPassword: ""
      })

      // Fetch agency data via Django API
      if (userRecord.agency_id) {
        let agencyData: AgencyData | null = null

        if (accessToken) {
          try {
            const data = await fetchApi<{ display_name: string | null; name: string }>(
              `/api/agencies/${userRecord.agency_id}`,
              accessToken,
              'Failed to load agency data'
            )
            agencyData = data
          } catch {
            agencyData = null
          }
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
    } catch (err) {
      console.error(`[setup-account] CATCH: Error at +${Date.now() - startTime}ms:`, err)
      setErrors(['Failed to load user data'])
    } finally {
      console.log(`[setup-account] FINALLY: Setting loading=false at +${Date.now() - startTime}ms`)
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
      // Try to get a fresh session first
      let accessToken: string | null = null

      // First, try to get session from Supabase (most reliable)
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession())
        if (session?.access_token) {
          accessToken = session.access_token
        }
      } catch {
        // Timeout, continue to fallback
      }

      // Fallback to stored invite tokens
      if (!accessToken) {
        const storedTokens = getInviteTokens()
        if (storedTokens.accessToken) {
          // Validate the stored token before using it
          const payload = decodeAndValidateJwt(storedTokens.accessToken)
          if (payload) {
            accessToken = storedTokens.accessToken
          } else {
            // Token is expired, clear it
            clearInviteTokens()
          }
        }
      }

      if (!accessToken) {
        setErrors(['Your session has expired. Please click the invitation link in your email again.'])
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Use backend API to setup account (handles password + profile update)
      await authApi.setupAccount(accessToken, {
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber || undefined,
      })

      // Update user status via Django API - only clients skip the onboarding wizard
      if (userData?.role === 'client') {
        await fetchApi(
          `/api/user/profile`,
          accessToken,
          'Failed to update status',
          {
            method: 'PUT',
            body: { status: 'active' }
          }
        )
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
    } catch (err) {
      if (err instanceof AuthApiError) {
        setErrors([err.message])
      } else {
        setErrors(['Failed to complete setup. Please try again.'])
      }
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
            <div className="mt-3 flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setErrors([])
                  setLoading(true)
                  fetchUserData()
                }}
              >
                Retry
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/login')}
                className="text-destructive"
              >
                Back to Login
              </Button>
            </div>
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
