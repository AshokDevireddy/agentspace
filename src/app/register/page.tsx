'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAgencyBranding } from "@/contexts/AgencyBrandingContext"
import { useTheme } from "next-themes"
import { useNotification } from '@/contexts/notification-context'
import { useRegister } from '@/hooks/mutations'

export default function RegisterPage() {
  const { showSuccess } = useNotification()
  const router = useRouter()
  const { branding, isWhiteLabel, loading: brandingLoading } = useAgencyBranding()
  const { setTheme } = useTheme()

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    agencyName: ""
  })
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})

  // Use TanStack Query mutation for registration
  const registerMutation = useRegister()

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

    // Phone validation (10 digits) - optional
    if (formData.phoneNumber && formData.phoneNumber.length !== 10) {
      newErrors.push("Phone number must be 10 digits")
      newErrorFields.phoneNumber = "Invalid phone format"
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

    // Clear any previous errors
    setErrors([])

    registerMutation.mutate(
      {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        agencyName: formData.agencyName,
      },
      {
        onSuccess: () => {
          // Clear form
          setFormData({
            email: "",
            firstName: "",
            lastName: "",
            phoneNumber: "",
            agencyName: ""
          })

          // Show success message and redirect to login
          showSuccess('Registration successful! Please check your email for an invitation link to complete your account setup.')
          router.push('/login')
        },
        onError: (error) => {
          console.error('Error during registration:', error)
          setErrors([error.message || 'Registration failed. Please try again.'])
        },
      }
    )
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
        <div className="bg-card shadow-lg rounded-md p-8 border border-border">
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

            {/* Submit Button */}
            <div className="pt-6">
              <Button
                type="submit"
                disabled={registerMutation.isPending || registerMutation.isSuccess}
                className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-md disabled:opacity-50"
              >
                {registerMutation.isPending || registerMutation.isSuccess ? 'Sending invitation...' : 'Create Admin Account'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                You'll receive an email to set your password and complete setup
              </p>
            </div>

            {/* Back to Login */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-foreground hover:text-foreground/80 font-medium"
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

