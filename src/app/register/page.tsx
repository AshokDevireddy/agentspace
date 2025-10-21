'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function RegisterPage() {
  const supabase = createClient()
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    agencyName: ""
  })
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      newErrors.push("Please enter a valid email address")
      newErrorFields.email = "Invalid email format"
    }

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.push("First name is required")
      newErrorFields.firstName = "Required"
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.push("Last name is required")
      newErrorFields.lastName = "Required"
    }

    // Agency name validation
    if (!formData.agencyName.trim()) {
      newErrors.push("Agency name is required")
      newErrorFields.agencyName = "Required"
    }

    // Phone validation (10 digits)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)

    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('User creation failed')

      // 2. Create agency
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .insert([{
          name: formData.agencyName,
          code: formData.agencyName.toLowerCase().replace(/\s+/g, '-'),
          display_name: formData.agencyName,
          is_active: true,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (agencyError) {
        console.error('Error creating agency:', agencyError)
        throw new Error('Failed to create agency')
      }

      // 3. Create user profile in users table with agency_id
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          auth_user_id: authData.user.id,
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone_number: formData.phoneNumber || null,
          role: 'admin',
          is_admin: true,
          status: 'active',
          perm_level: 'admin',
          agency_id: agencyData.id,
          created_at: new Date().toISOString(),
        }])

      if (insertError) {
        // If profile creation fails, we should clean up
        console.error('Error creating user profile:', insertError)
        throw new Error('Failed to create user profile')
      }

      // Clear form
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
        agencyName: ""
      })

      // Redirect to login with success message
      router.push('/login?message=registration-success')
    } catch (error: any) {
      console.error('Error during registration:', error)
      setErrors([error.message || 'Registration failed. Please try again.'])
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

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card shadow-lg rounded-lg p-8 border border-border">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Create Admin Account</h1>
            <p className="text-muted-foreground">Register as an administrator for AgentSpace</p>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`h-12 ${errorFields.email ? 'border-destructive' : ''}`}
                placeholder="admin@example.com"
                required
              />
              {errorFields.email && (
                <p className="text-destructive text-sm">{errorFields.email}</p>
              )}
            </div>

            {/* First Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                First Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className={`h-12 ${errorFields.firstName ? 'border-destructive' : ''}`}
                placeholder="John"
                required
              />
              {errorFields.firstName && (
                <p className="text-destructive text-sm">{errorFields.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Last Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                className={`h-12 ${errorFields.lastName ? 'border-destructive' : ''}`}
                placeholder="Doe"
                required
              />
              {errorFields.lastName && (
                <p className="text-destructive text-sm">{errorFields.lastName}</p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Phone Number (Optional)
              </label>
              <Input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                className={`h-12 ${errorFields.phoneNumber ? 'border-destructive' : ''}`}
                placeholder="1234567890"
              />
              {errorFields.phoneNumber && (
                <p className="text-destructive text-sm">{errorFields.phoneNumber}</p>
              )}
            </div>

            {/* Agency Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Agency Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={formData.agencyName}
                onChange={(e) => handleInputChange("agencyName", e.target.value)}
                className={`h-12 ${errorFields.agencyName ? 'border-destructive' : ''}`}
                placeholder="Enter your agency name"
                required
              />
              {errorFields.agencyName && (
                <p className="text-destructive text-sm">{errorFields.agencyName}</p>
              )}
              <p className="text-sm text-muted-foreground">This will be the agency you're an admin for</p>
            </div>

            {/* Password Section */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-medium text-foreground mb-4">Set Password</h3>

              {/* Password */}
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-foreground">
                  Password <span className="text-destructive">*</span>
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className={`h-12 ${errorFields.password ? 'border-destructive' : ''}`}
                  placeholder="Enter your password"
                  required
                />
                {errorFields.password && (
                  <p className="text-destructive text-sm">{errorFields.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Confirm Password <span className="text-destructive">*</span>
                </label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className={`h-12 ${errorFields.confirmPassword ? 'border-destructive' : ''}`}
                  placeholder="Confirm your password"
                  required
                />
                {errorFields.confirmPassword && (
                  <p className="text-destructive text-sm">{errorFields.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Creating account...' : 'Create Admin Account'}
              </Button>
            </div>

            {/* Back to Login */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

