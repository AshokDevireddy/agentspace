"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"

interface Product {
  id: string
  carrier_id: string
  agency_id?: string
  name: string
  product_code?: string
  is_active: boolean
  created_at?: string
}

interface AddProductModalProps {
  trigger: React.ReactNode
  carrierId: string
  onProductCreated?: (product: Product) => void
}

export default function AddProductModal({ trigger, carrierId, onProductCreated }: AddProductModalProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: "",
    productCode: "",
    status: true
  })
  const [isOpen, setIsOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: string[] = []
    const newErrorFields: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.push("Product name is required")
      newErrorFields.name = "Product name is required"
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
        setErrors(['You must be logged in to create products'])
        return
      }

      // Get the session to get the access token (using getSession for token only, not authentication)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        setErrors(['Authentication failed. Please log in again.'])
        return
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          carrier_id: carrierId,
          name: formData.name,
          product_code: formData.productCode || null,
          is_active: formData.status
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) { // 409 Conflict for duplicates
          setErrors([data.error || 'A product with this name already exists for this carrier.']);
        } else {
          setErrors([data.error || 'Failed to create product. Please try again.']);
        }
        return;
      }

      // Add the new product to the parent component's state
      if (onProductCreated && data.product) {
        onProductCreated(data.product)
      }

      // Show success message about setting commissions
      if (data.message) {
        alert(data.message)
      }

      setIsOpen(false)
      // Reset form
      setFormData({
        name: "",
        productCode: "",
        status: true
      })
      setErrors([])
      setErrorFields({})
    } catch (error) {
      console.error('Error creating product:', error)
      setErrors(['Failed to create product. Please try again.'])
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 mb-6">Add a Product</DialogTitle>
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
          {/* Product Name */}
          <div className="space-y-3">
            <label className="block text-lg font-bold text-gray-900">
              Product Name *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={`h-12 text-lg bg-white text-gray-900 border-2 ${errorFields.name ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Enter product name"
              required
            />
            {errorFields.name && (
              <p className="text-red-500 text-sm font-medium">{errorFields.name}</p>
            )}
          </div>

          {/* Product Code */}
          <div className="space-y-3">
            <label className="block text-lg font-bold text-gray-900">
              Product Code (Optional)
            </label>
            <Input
              type="text"
              value={formData.productCode}
              onChange={(e) => handleInputChange("productCode", e.target.value)}
              className="h-12 text-lg bg-white text-gray-900 border-2 border-gray-300"
              placeholder="Enter product code"
            />
          </div>

          {/* Status */}
          <div className="space-y-3">
            <label className="block text-lg font-bold text-gray-900">
              Status
            </label>
            <div className="flex items-center space-x-4">
              <Checkbox
                checked={formData.status}
                onCheckedChange={(checked) => handleInputChange("status", checked)}
              />
              <span className="text-lg font-medium text-gray-900">
                {formData.status ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-8">
            <button
              type="submit"
              className="w-full py-4 rounded-lg bg-blue-600 text-white font-bold text-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Creating Product...' : 'Submit'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}