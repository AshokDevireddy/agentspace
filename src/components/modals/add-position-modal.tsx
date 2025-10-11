"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"

interface Position {
  id: string
  name: string
  level: number
  is_active: boolean
  base_commission_rate?: number
  created_at?: string
  updated_at?: string
  created_by?: string
}

interface AddPositionModalProps {
  trigger: React.ReactNode
  onPositionCreated?: (position: Position) => void
}

export default function AddPositionModal({ trigger, onPositionCreated }: AddPositionModalProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: "",
    priority: "",
    status: true,
    baseCommissionRate: ""
  })
  const [isOpen, setIsOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Title validation
    if (!formData.title.trim()) {
      newErrors.push("Title is required")
      newErrorFields.title = "Title is required"
    }

    // Priority validation (must be a positive whole number)
    if (!formData.priority || isNaN(Number(formData.priority)) || Number(formData.priority) < 0 || !Number.isInteger(Number(formData.priority))) {
      newErrors.push("Priority must be a positive whole number")
      newErrorFields.priority = "Invalid priority"
    }

    // Base commission rate validation (1-200)
    if (!formData.baseCommissionRate || isNaN(Number(formData.baseCommissionRate)) || Number(formData.baseCommissionRate) < 1 || Number(formData.baseCommissionRate) > 200) {
      newErrors.push("Base commission rate must be between 1 and 200")
      newErrorFields.baseCommissionRate = "Must be between 1-200"
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

        try {
      setSubmitting(true)

      // Check if user is authenticated
      if (!user?.id) {
        setErrors(['You must be logged in to create positions'])
        return
      }

      // Get the user's database ID from the users table
      const { data: userData, error: userError } = await createClient()
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (userError || !userData) {
        setErrors(['Failed to get user information. Please try again.'])
        return
      }

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.title,
          level: Number(formData.priority),
          base_commission_rate: Number(formData.baseCommissionRate),
          is_active: formData.status,
          created_by: userData.id
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create position')
      }

      // Add the new position to the parent component's state
      if (onPositionCreated && data.position) {
        onPositionCreated(data.position)
      }

      setIsOpen(false)
      // Reset form
      setFormData({
        title: "",
        priority: "",
        status: true,
        baseCommissionRate: ""
      })
      setErrors([])
      setErrorFields({})
    } catch (error) {
      console.error('Error creating position:', error)
      setErrors(['Failed to create position. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 mb-6">Add a Position</DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              Title
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className={`h-12 ${errorFields.title ? 'border-red-500' : ''}`}
              placeholder="Enter position title"
              required
            />
            {errorFields.title && (
              <p className="text-red-500 text-sm">{errorFields.title}</p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              Priority
            </label>
            <Input
              type="number"
              value={formData.priority}
              onChange={(e) => handleInputChange("priority", e.target.value)}
              className={`h-12 ${errorFields.priority ? 'border-red-500' : ''}`}
              placeholder="Enter priority level (whole number)"
              min="0"
              step="1"
              required
            />
            {errorFields.priority && (
              <p className="text-red-500 text-sm">{errorFields.priority}</p>
            )}
          </div>

          {/* Base Commission Rate */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              Base Commission Rate
            </label>
            <Input
              type="number"
              value={formData.baseCommissionRate}
              onChange={(e) => handleInputChange("baseCommissionRate", e.target.value)}
              className={`h-12 ${errorFields.baseCommissionRate ? 'border-red-500' : ''}`}
              placeholder="Enter rate (1-200)"
              min="1"
              max="200"
              step="0.01"
              required
            />
            {errorFields.baseCommissionRate && (
              <p className="text-red-500 text-sm">{errorFields.baseCommissionRate}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              Status
            </label>
            <div className="flex items-center space-x-3">
              <Checkbox
                checked={formData.status}
                onCheckedChange={(checked) => handleInputChange("status", checked)}
              />
              <span className="text-sm text-gray-700">
                {formData.status ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-indigo-500 text-white font-semibold text-lg hover:bg-indigo-600 transition disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Creating Position...' : 'Submit'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}