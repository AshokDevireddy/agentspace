"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/providers/AuthProvider"
import { useNotification } from '@/contexts/notification-context'
import { useCreateProduct } from '@/hooks/mutations/useProductMutations'

interface Product {
  id: string
  carrierId: string
  agencyId?: string
  name: string
  productCode?: string
  isActive: boolean
  createdAt?: string
}

interface AddProductModalProps {
  trigger: React.ReactNode
  carrierId: string
  onProductCreated?: (product: Product) => void
}

export default function AddProductModal({ trigger, carrierId, onProductCreated }: AddProductModalProps) {
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [formData, setFormData] = useState({
    name: "",
    productCode: "",
    status: true
  })
  const [isOpen, setIsOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [errorFields, setErrorFields] = useState<Record<string, string>>({})

  // Use TanStack Query mutation for proper cache invalidation
  const createProductMutation = useCreateProduct()

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

    // Check if user is authenticated
    if (!user?.id) {
      setErrors(['You must be logged in to create products'])
      return
    }

    // Use mutation for proper TanStack Query integration
    createProductMutation.mutate(
      {
        carrierId: carrierId,
        name: formData.name,
        productCode: formData.productCode || null,
        isActive: formData.status
      },
      {
        onSuccess: (data) => {
          // Add the new product to the parent component's state
          if (onProductCreated && data.product) {
            onProductCreated(data.product)
          }

          // Show success message about setting commissions
          if (data.message) {
            showSuccess(data.message)
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
        },
        onError: (error) => {
          console.error('Error creating product:', error)
          const message = error.message || 'Failed to create product. Please try again.'
          // Check for duplicate error
          if (message.includes('duplicate') || message.includes('already exists')) {
            setErrors(['A product with this name already exists for this carrier.'])
          } else {
            setErrors([message])
          }
        }
      }
    )
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground mb-6">Add a Product</DialogTitle>
          <DialogDescription className="text-muted-foreground">Add a new product for this carrier</DialogDescription>
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
            <label className="block text-lg font-bold text-foreground">
              Product Name *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={`h-12 text-lg bg-background text-foreground border-2 ${errorFields.name ? 'border-red-500' : 'border-border'}`}
              placeholder="Enter product name"
              required
            />
            {errorFields.name && (
              <p className="text-red-500 text-sm font-medium">{errorFields.name}</p>
            )}
          </div>

          {/* Product Code */}
          <div className="space-y-3">
            <label className="block text-lg font-bold text-foreground">
              Product Code (Optional)
            </label>
            <Input
              type="text"
              value={formData.productCode}
              onChange={(e) => handleInputChange("productCode", e.target.value)}
              className="h-12 text-lg bg-background text-foreground border-2 border-border"
              placeholder="Enter product code"
            />
          </div>

          {/* Status */}
          <div className="space-y-3">
            <label className="block text-lg font-bold text-foreground">
              Status
            </label>
            <div className="flex items-center space-x-4">
              <Checkbox
                checked={formData.status}
                onCheckedChange={(checked) => handleInputChange("status", checked)}
              />
              <span className="text-lg font-medium text-foreground">
                {formData.status ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-8">
            <button
              type="submit"
              className="w-full py-4 rounded-lg bg-blue-600 text-white font-bold text-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-60"
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending ? 'Creating Product...' : 'Submit'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}