'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UserData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  role: 'admin' | 'agent' | 'client'
  position_id?: string
  position_name?: string
  total_prod?: number
  total_policies_sold?: number
  perm_level: string
  annual_goal?: number
  is_admin: boolean
  is_active: boolean
  upline_id?: string | null
  upline_name?: string
}

export default function SetupAccount() {
  const supabase = createClient()
  const router = useRouter()

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
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0 })

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      console.log('User authenticated:', user.id)

      // Try to find user in pending_invite table
      const { data, error } = await supabase
        .from('pending_invite')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user data:', error)
        setErrors(['Failed to load user data. Your invitation may have expired.'])
        setLoading(false)
        return
      }

      setUserData(data)
      console.log('User data loaded:', data.role)
      setFormData({
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        phoneNumber: data.phone_number || "",
        password: "",
        confirmPassword: ""
      })
    } catch (error) {
      console.error('Error:', error)
      setErrors(['Failed to load user data'])
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Phone validation (10 digits) - optional for clients
    if (formData.phoneNumber && formData.phoneNumber.length !== 10) {
      newErrors.push("Phone number must be 10 digits")
      newErrorFields.phoneNumber = "Invalid phone format"
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

  const updatePassword = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password
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
      console.log(userData?.id)
      console.log(formData);

      // Get current user to use their auth ID
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setErrors(['Authentication error. Please try logging in again.'])
        return
      }

      // Insert data into users table, transferring all data from pending_invite
      const userInsertData: any = {
        auth_user_id: user.id,
        email: userData?.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber || null,
        role: userData?.role,
        perm_level: userData?.perm_level,
        is_admin: userData?.is_admin || false,
        is_active: userData?.is_active ?? true,
        agency_id: (userData as any)?.agency_id || null,
        created_at: new Date().toISOString(),
      }

      // Add agent-specific fields (these exist in both pending_invite and users tables)
      if (userData?.role === 'agent') {
        userInsertData.annual_goal = userData?.annual_goal || 0
        userInsertData.total_prod = userData?.total_prod || 0
        userInsertData.total_policies_sold = userData?.total_policies_sold || 0
        userInsertData.upline_id = userData?.upline_id || null  // This is critical for downline hierarchy!
        userInsertData.agent_number = (userData as any)?.agent_number || null
        userInsertData.start_date = (userData as any)?.start_date || new Date().toISOString().split('T')[0]

        console.log('Setting up agent with upline_id:', userData?.upline_id)
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([userInsertData])
        .select()
        .single()

      if (insertError || !newUser) {
        console.error('Error inserting user data:', insertError)
        setErrors(['Failed to create user account. Please try again.'])
        return
      }

      // For clients: Update any deals that have this pending_invite ID as client_id
      if (userData?.role === 'client') {
        const { error: dealsUpdateError } = await supabase
          .from('deals')
          .update({ client_id: newUser.id })
          .eq('client_id', userData?.id)

        if (dealsUpdateError) {
          console.error('Error updating deals with new client_id:', dealsUpdateError)
          console.log('Warning: Failed to update deals, but continuing with account setup')
        } else {
          console.log('Successfully migrated deals to new user ID')
        }
      }

      // Delete the row from pending_invite table
      const { error: deleteError } = await supabase
        .from('pending_invite')
        .delete()
        .eq('id', userData?.id)

      if (deleteError) {
        console.error('Error deleting from pending_invite:', deleteError)
        console.log('Warning: Failed to cleanup pending_invite record')
      }

      // Update password securely through Supabase Auth
      const passwordUpdated = await updatePassword()

      if (!passwordUpdated) {
        setErrors(['Failed to update password. Please try again.'])
        return
      }

      // Clear sensitive data from memory
      setFormData({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        password: "",
        confirmPassword: ""
      })

      // Redirect based on role
      if (userData?.role === 'client') {
        router.push('/client/dashboard')
      } else {
        router.push('/')
      }
    } catch (error) {
      console.error('Error updating account:', error)
      setErrors(['Failed to update account. Please try again.'])
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

  const handleLockedFieldInteraction = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })

    // Hide tooltip after 2 seconds
    setTimeout(() => {
      setTooltip({ show: false, x: 0, y: 0 })
    }, 2000)
  }

  // Group errors by type for better display
  const phoneErrors = errors.filter(error => error.includes('Phone'))
  const passwordErrors = errors.filter(error => error.includes('Password') || error.includes('match'))
  const otherErrors = errors.filter(error => !error.includes('Phone') && !error.includes('Password') && !error.includes('match'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
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
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 relative">
      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="fixed z-50 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg shadow-lg transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          Contact Admin for Changes Here
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="border-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <div className="bg-card shadow-lg rounded-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {userData.role === 'client' ? 'Welcome!' : 'Setup Account'}
            </h1>
            <p className="text-muted-foreground">
              {userData.role === 'client'
                ? 'Please set up your account to access your information'
                : 'Please confirm your information and set up your password'
              }
            </p>
          </div>

          {/* Phone Number Errors */}
          {phoneErrors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {phoneErrors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

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
            {/* First name - Editable */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                First name
              </label>
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className="h-12"
                required
              />
            </div>

            {/* Last name - Editable */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Last name
              </label>
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                className="h-12"
                required
              />
            </div>

            {/* Email - Locked */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                type="email"
                value={userData.email}
                className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                onClick={handleLockedFieldInteraction}
                onMouseEnter={handleLockedFieldInteraction}
                readOnly
              />
            </div>

            {/* Phone number - Editable */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Phone number {userData.role === 'agent' ? <span className="text-red-500">*</span> : '(Optional)'}
              </label>
              <Input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                className={`h-12 ${errorFields.phoneNumber ? 'border-red-500' : ''}`}
                placeholder="1234567890"
                required={userData.role === 'agent'}
              />
              {errorFields.phoneNumber && (
                <p className="text-red-500 text-sm">{errorFields.phoneNumber}</p>
              )}
            </div>

            {/* Agent-specific fields */}
            {userData.role === 'agent' && (
              <>
                {/* Permission Level - Locked */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Permission Level
                  </label>
                  <Input
                    type="text"
                    value={userData.perm_level.charAt(0).toUpperCase() + userData.perm_level.slice(1).toLowerCase()}
                    className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                    onClick={handleLockedFieldInteraction}
                    onMouseEnter={handleLockedFieldInteraction}
                    readOnly
                  />
                </div>

                {/* Upline Agent - Locked */}
                {userData.upline_name && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Upline Agent
                    </label>
                    <Input
                      type="text"
                      value={userData.upline_name}
                      className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                      onClick={handleLockedFieldInteraction}
                      onMouseEnter={handleLockedFieldInteraction}
                      readOnly
                    />
                  </div>
                )}
              </>
            )}

            {/* Password Setup Section */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-medium text-foreground mb-4">Set Up Password</h3>

              {/* Password */}
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

              {/* Confirm Password */}
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

            {/* Submit Button */}
            <div className="pt-6">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Setting up account...' : 'Complete Setup'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
