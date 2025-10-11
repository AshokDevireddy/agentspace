"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Plus, Check, X } from "lucide-react"
import AddPositionModal from "@/components/modals/add-position-modal"
import AddProductModal from "@/components/modals/add-product-modal"
import { createClient } from "@/lib/supabase/client"

// Types for position data
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

// Types for carrier data
interface Carrier {
  id: string
  name: string
  display_name: string
  is_active: boolean
  created_at?: string
}

// Types for product data
interface Product {
  id: string
  carrier_id: string
  agency_id?: string
  name: string
  product_code?: string
  is_active: boolean
  created_at?: string
}

// Types for commission structure data
interface CommissionStructure {
  id: string
  carrier_id: string
  product_id?: string
  position_id: string
  commission_type: 'initial'
  percentage: number
  level: number
  effective_date: string
  end_date?: string
  is_active: boolean
  notes?: string
  created_by?: string
  created_at?: string
  updated_at?: string
}

// const mockCarriers = [
//   { id: "1", name: "TIER", displayName: "TIER Financial Services" },
//   { id: "2", name: "AFLAC", displayName: "Aflac" },
//   { id: "3", name: "AMAM", displayName: "American Amicable" },
// ]

// const mockProducts = [
//   { id: "1", carrierId: "1", name: "TIER Final Exp Level", productCode: "TIER_FEL" },
//   { id: "2", carrierId: "1", name: "TIER Final Exp Modified", productCode: "TIER_FEM" },
//   { id: "3", carrierId: "2", name: "Aflac Accident", productCode: "AFL_ACC" },
// ]

export default function ConfigurationPage() {
  const [activeTab, setActiveTab] = useState<"positions" | "products" | "commissions">("positions")
  const [selectedCarrier, setSelectedCarrier] = useState<string>("")
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [selectedCommissionType, setSelectedCommissionType] = useState<string>("initial")
  const [positions, setPositions] = useState<Position[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [positionsLoaded, setPositionsLoaded] = useState(false)
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{
    name: string
    level: string
    is_active: boolean
    base_commission_rate: string
  }>({ name: "", level: "", is_active: true, base_commission_rate: "" })
  const [originalPositionData, setOriginalPositionData] = useState<{
    name: string
    level: string
    is_active: boolean
    base_commission_rate: string
  } | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Carriers and Products state with caching
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [carriersLoading, setCarriersLoading] = useState(false)
  const [carriersLoaded, setCarriersLoaded] = useState(false)
  const [allProducts, setAllProducts] = useState<Product[]>([]) // Cache all products
  const [products, setProducts] = useState<Product[]>([]) // Filtered products for display
  const [productsLoading, setProductsLoading] = useState(false)
  const [allProductsLoaded, setAllProductsLoaded] = useState(false)

  // Product editing state
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editProductFormData, setEditProductFormData] = useState<{
    name: string
    product_code: string
    is_active: boolean
  }>({ name: "", product_code: "", is_active: true })
  const [originalProductData, setOriginalProductData] = useState<{
    name: string
    product_code: string
    is_active: boolean
  } | null>(null)
  const [deleteProductConfirmOpen, setDeleteProductConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [updatingProduct, setUpdatingProduct] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(false)

  // Commission structures state
  const [commissionStructures, setCommissionStructures] = useState<CommissionStructure[]>([])
  const [commissionStructuresLoading, setCommissionStructuresLoading] = useState(false)
  const [commissionInputValues, setCommissionInputValues] = useState<Record<string, string>>({})
  const [originalCommissionValues, setOriginalCommissionValues] = useState<Record<string, string>>({})
  const [savingCommissions, setSavingCommissions] = useState<Record<string, boolean>>({})

  // Consolidated data loading - fetch all data when any tab is first accessed
  useEffect(() => {
    const needsPositions = activeTab === "positions" && !positionsLoaded
    const needsCarriersProducts = (activeTab === "products" || activeTab === "commissions") && (!carriersLoaded || !allProductsLoaded)

    if (needsPositions || needsCarriersProducts) {
      fetchAllData()
    }
  }, [activeTab, positionsLoaded, carriersLoaded, allProductsLoaded])

  // Filter products when carrier is selected
  useEffect(() => {
    if (selectedCarrier && allProducts.length > 0) {
      const filteredProducts = allProducts.filter(product => product.carrier_id === selectedCarrier)
      setProducts(filteredProducts)
    } else {
      setProducts([])
    }
  }, [selectedCarrier, allProducts])

  // Clear selected product when carrier changes
  useEffect(() => {
    setSelectedProduct("")
  }, [selectedCarrier])

  // Fetch commission structures when both carrier and product are selected
  useEffect(() => {
    if (selectedCarrier && selectedProduct && selectedCommissionType) {
      fetchCommissionStructures(selectedCarrier, selectedProduct, selectedCommissionType)
    } else {
      setCommissionStructures([])
      setCommissionInputValues({})
      setOriginalCommissionValues({})
    }
  }, [selectedCarrier, selectedProduct, selectedCommissionType])

  const fetchAllData = async () => {
    try {
      const promises = []

      // Get the current user's session to get the access token
      const { data: { session } } = await createClient().auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('No access token available. Please log in again.')
      }

      // Always fetch positions for the current user's agency if not loaded
      if (!positionsLoaded) {
        setPositionsLoading(true)
        // Fetch current user to get agency_id
        const meResp = await fetch('/api/user/profile?user_id=' + (session?.user?.id || ''), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include'
        })
        let agencyIdParam = ''
        if (meResp.ok) {
          // Fallback: if your profile endpoint does not include agency_id, you can add another call to /api/users?id=... to fetch it.
          // For now we'll optimistically fetch positions without agency filter if not available.
          try {
            const me = await meResp.json()
            const agencyId = me?.data?.agency_id || me?.agency_id
            if (agencyId) {
              agencyIdParam = `?agencyId=${encodeURIComponent(agencyId)}`
            }
          } catch {}
        }

        promises.push(
          fetch(`/api/positions/all${agencyIdParam}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include'
          })
        )
      }

      // Always fetch carriers and products if not loaded
      if (!carriersLoaded || !allProductsLoaded) {
        setCarriersLoading(true)
        setProductsLoading(true)
        promises.push(
          fetch('/api/carriers/agency', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include'
          }),
          fetch('/api/products/all', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include'
          })
        )
      }

      if (promises.length === 0) return

      const responses = await Promise.all(promises)

      let responseIndex = 0

      // Handle positions response
      if (!positionsLoaded) {
        const positionsResponse = responses[responseIndex++]
        if (!positionsResponse.ok) {
          const errorData = await positionsResponse.json()
          throw new Error(errorData.error || 'Failed to fetch positions')
        }
        const positionsData = await positionsResponse.json()
        setPositions(positionsData)
        setPositionsLoaded(true)
      }

      // Handle carriers and products responses
      if (!carriersLoaded || !allProductsLoaded) {
        const carriersResponse = responses[responseIndex++]
        const productsResponse = responses[responseIndex++]

        if (!carriersResponse.ok) {
          const errorData = await carriersResponse.json()
          throw new Error(errorData.error || 'Failed to fetch carriers')
        }

        if (!productsResponse.ok) {
          const errorData = await productsResponse.json()
          // Handle specific agency-related errors
          if (productsResponse.status === 403) {
            throw new Error('You are not associated with an agency. Please contact your administrator.')
          } else if (productsResponse.status === 401) {
            throw new Error('Please log in to view products.')
          } else {
            throw new Error(errorData.error || 'Failed to fetch products')
          }
        }

        const [carriersData, productsData] = await Promise.all([
          carriersResponse.json(),
          productsResponse.json()
        ])

        setCarriers(carriersData)
        setAllProducts(productsData)
        setCarriersLoaded(true)
        setAllProductsLoaded(true)
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      // Show error to user - you might want to add a toast notification here
      alert(`Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setPositionsLoading(false)
      setCarriersLoading(false)
      setProductsLoading(false)
    }
  }

  const fetchCommissionStructures = async (carrierId: string, productId: string, commissionType: string) => {
    try {
      setCommissionStructuresLoading(true)
      const response = await fetch(`/api/commission-structures?carrier_id=${carrierId}&product_id=${productId}&commission_type=${commissionType}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch commission structures')
      }

      const data = await response.json()
      setCommissionStructures(data)

      // Pre-populate input values with existing commission percentages
      const inputValues: Record<string, string> = {}
      const originalValues: Record<string, string> = {}
      data.forEach((structure: CommissionStructure) => {
        const percentageStr = structure.percentage.toString()
        inputValues[structure.position_id] = percentageStr
        originalValues[structure.position_id] = percentageStr
      })
      setCommissionInputValues(inputValues)
      setOriginalCommissionValues(originalValues)
    } catch (error) {
      console.error('Error fetching commission structures:', error)
      setCommissionStructures([])
      setCommissionInputValues({})
    } finally {
      setCommissionStructuresLoading(false)
    }
  }

  // Callback to add new position to local state
  const handlePositionCreated = (newPosition: Position) => {
    setPositions(prev => [...prev, newPosition])
  }

  // Start editing a position
  const handleEditPosition = (position: Position) => {
    const formData = {
      name: position.name,
      level: position.level.toString(),
      is_active: position.is_active,
      base_commission_rate: position.base_commission_rate?.toString() || ""
    }
    setEditingPositionId(position.id)
    setEditFormData(formData)
    setOriginalPositionData(formData) // Store original data for comparison
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingPositionId(null)
    setEditFormData({ name: "", level: "", is_active: true, base_commission_rate: "" })
    setOriginalPositionData(null)
  }

  // Save edited position
  const handleSaveEdit = async () => {
    if (!editingPositionId || !originalPositionData) return

    // Check if any changes were made
    const hasChanges = (
      editFormData.name !== originalPositionData.name ||
      editFormData.level !== originalPositionData.level ||
      editFormData.is_active !== originalPositionData.is_active ||
      editFormData.base_commission_rate !== originalPositionData.base_commission_rate
    )

    // If no changes, just exit edit mode
    if (!hasChanges) {
      setEditingPositionId(null)
      setEditFormData({ name: "", level: "", is_active: true, base_commission_rate: "" })
      setOriginalPositionData(null)
      return
    }

    try {
      setUpdating(true)

      const response = await fetch(`/api/positions/${editingPositionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name,
          level: Number(editFormData.level),
          is_active: editFormData.is_active,
          base_commission_rate: editFormData.base_commission_rate ? Number(editFormData.base_commission_rate) : null
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update position')
      }

      // Update local state
      setPositions(prev =>
        prev.map(pos =>
          pos.id === editingPositionId
            ? {
                ...pos,
                name: editFormData.name,
                level: Number(editFormData.level),
                is_active: editFormData.is_active,
                base_commission_rate: editFormData.base_commission_rate ? Number(editFormData.base_commission_rate) : undefined
              }
            : pos
        )
      )

      // Exit edit mode
      setEditingPositionId(null)
      setEditFormData({ name: "", level: "", is_active: true, base_commission_rate: "" })
      setOriginalPositionData(null)
    } catch (error) {
      console.error('Error updating position:', error)
      // You could add error handling here
    } finally {
      setUpdating(false)
    }
  }

  // Handle delete confirmation
  const handleDeletePosition = (position: Position) => {
    setPositionToDelete(position)
    setDeleteConfirmOpen(true)
  }

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!positionToDelete) return

    try {
      setDeleting(true)

      const response = await fetch(`/api/positions/${positionToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete position')
      }

      // Remove from local state
      setPositions(prev => prev.filter(pos => pos.id !== positionToDelete.id))

      // Close modal
      setDeleteConfirmOpen(false)
      setPositionToDelete(null)
    } catch (error) {
      console.error('Error deleting position:', error)
      // You could add error handling here
    } finally {
      setDeleting(false)
    }
  }

  // Cancel delete
  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false)
    setPositionToDelete(null)
  }

  // Product management functions
  const handleProductCreated = async (newProduct: Product) => {
    // Add to both cached and displayed products
    setAllProducts(prev => [...prev, newProduct])

    // Only add to displayed products if it matches the selected carrier
    if (newProduct.carrier_id === selectedCarrier) {
      setProducts(prev => [...prev, newProduct])
    }

    // Check if this is a new carrier for the agency
    const existingCarrier = carriers.find(carrier => carrier.id === newProduct.carrier_id)
    if (!existingCarrier) {
      // Fetch updated carriers list to include the new carrier
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const accessToken = session?.access_token

        if (accessToken) {
          const response = await fetch('/api/carriers/agency', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include'
          })

          if (response.ok) {
            const updatedCarriers = await response.json()
            setCarriers(updatedCarriers)
          }
        }
      } catch (error) {
        console.error('Error refreshing carriers:', error)
      }
    }
  }

  const handleEditProduct = (product: Product) => {
    const formData = {
      name: product.name,
      product_code: product.product_code || "",
      is_active: product.is_active
    }
    setEditingProductId(product.id)
    setEditProductFormData(formData)
    setOriginalProductData(formData) // Store original data for comparison
  }

  const handleCancelProductEdit = () => {
    setEditingProductId(null)
    setEditProductFormData({ name: "", product_code: "", is_active: true })
    setOriginalProductData(null)
  }

  const handleSaveProductEdit = async () => {
    if (!editingProductId || !originalProductData) return

    // Check if any changes were made
    const hasChanges = (
      editProductFormData.name !== originalProductData.name ||
      editProductFormData.product_code !== originalProductData.product_code ||
      editProductFormData.is_active !== originalProductData.is_active
    )

    // If no changes, just exit edit mode
    if (!hasChanges) {
      setEditingProductId(null)
      setEditProductFormData({ name: "", product_code: "", is_active: true })
      setOriginalProductData(null)
      return
    }

    try {
      setUpdatingProduct(true)

      const response = await fetch(`/api/products/${editingProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editProductFormData.name,
          product_code: editProductFormData.product_code || null,
          is_active: editProductFormData.is_active
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update product')
      }

      // Update both cached and displayed products
      const updatedProduct = {
        name: editProductFormData.name,
        product_code: editProductFormData.product_code || undefined,
        is_active: editProductFormData.is_active
      }

      setAllProducts(prev =>
        prev.map(product =>
          product.id === editingProductId
            ? { ...product, ...updatedProduct }
            : product
        )
      )

      setProducts(prev =>
        prev.map(product =>
          product.id === editingProductId
            ? { ...product, ...updatedProduct }
            : product
        )
      )

      // Exit edit mode
      setEditingProductId(null)
      setEditProductFormData({ name: "", product_code: "", is_active: true })
      setOriginalProductData(null)
    } catch (error) {
      console.error('Error updating product:', error)
    } finally {
      setUpdatingProduct(false)
    }
  }

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product)
    setDeleteProductConfirmOpen(true)
  }

  const handleConfirmProductDelete = async () => {
    if (!productToDelete) return

    try {
      setDeletingProduct(true)

      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete product')
      }

      // Remove from both cached and displayed products
      setAllProducts(prev => prev.filter(product => product.id !== productToDelete.id))
      setProducts(prev => prev.filter(product => product.id !== productToDelete.id))

      // Check if this was the last product for this carrier
      const remainingProductsForCarrier = allProducts.filter(
        product => product.id !== productToDelete.id && product.carrier_id === productToDelete.carrier_id
      )

      if (remainingProductsForCarrier.length === 0) {
        // This was the last product for this carrier, refresh carriers list
        try {
          const { data: { session } } = await createClient().auth.getSession()
          const accessToken = session?.access_token

          if (accessToken) {
            const carriersResponse = await fetch('/api/carriers/agency', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              credentials: 'include'
            })

            if (carriersResponse.ok) {
              const updatedCarriers = await carriersResponse.json()
              setCarriers(updatedCarriers)

              // Clear selected carrier if it was the one that got removed
              if (selectedCarrier === productToDelete.carrier_id) {
                setSelectedCarrier("")
              }
            }
          }
        } catch (error) {
          console.error('Error refreshing carriers:', error)
        }
      }

      // Close modal
      setDeleteProductConfirmOpen(false)
      setProductToDelete(null)
    } catch (error) {
      console.error('Error deleting product:', error)
    } finally {
      setDeletingProduct(false)
    }
  }

  const handleCancelProductDelete = () => {
    setDeleteProductConfirmOpen(false)
    setProductToDelete(null)
  }

  // Commission structure management functions
  const handleSaveCommission = async (positionId: string) => {
    const inputValue = commissionInputValues[positionId]
    const originalValue = originalCommissionValues[positionId]
    const existingStructure = commissionStructures.find(cs => cs.position_id === positionId)

    // Check if there are no changes
    if (inputValue === originalValue) {
      return // Do nothing if no changes
    }

    if (!inputValue || parseFloat(inputValue) < 0) {
      return // Invalid input
    }

    try {
      setSavingCommissions(prev => ({ ...prev, [positionId]: true }))

      const requestData = {
        carrier_id: selectedCarrier,
        product_id: selectedProduct,
        position_id: positionId,
        commission_type: selectedCommissionType,
        percentage: parseFloat(inputValue),
        level: 0, // Default level
        effective_date: new Date().toISOString().split('T')[0], // Today's date
        is_active: true
      }

      let response
      if (existingStructure) {
        // Update existing structure
        response = await fetch(`/api/commission-structures/${existingStructure.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
          credentials: 'include'
        })
      } else {
        // Create new structure
        response = await fetch('/api/commission-structures', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
          credentials: 'include'
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save commission structure')
      }

      // Update local state
      if (existingStructure) {
        setCommissionStructures(prev =>
          prev.map(cs =>
            cs.position_id === positionId
              ? { ...cs, percentage: parseFloat(inputValue) }
              : cs
          )
        )
      } else {
        setCommissionStructures(prev => [...prev, data.commissionStructure])
      }

      // Update original values to reflect the new saved state
      setOriginalCommissionValues(prev => ({
        ...prev,
        [positionId]: inputValue
      }))

    } catch (error) {
      console.error('Error saving commission structure:', error)
    } finally {
      // Remove the loading state for this position entirely
      setSavingCommissions(prev => {
        const newState = { ...prev }
        delete newState[positionId]
        return newState
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-10 bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Configuration</h1>
          <p className="text-xl text-gray-700">Manage positions, products, and commission structures</p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex space-x-2 bg-white p-2 rounded-xl shadow-lg w-fit border border-gray-200">
            <button
              onClick={() => setActiveTab("positions")}
              className={`px-6 py-3 rounded-lg text-lg font-semibold transition-all duration-200 ${
                activeTab === "positions"
                  ? "bg-blue-600 text-white shadow-lg transform scale-105"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              Positions
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`px-6 py-3 rounded-lg text-lg font-semibold transition-all duration-200 ${
                activeTab === "products"
                  ? "bg-blue-600 text-white shadow-lg transform scale-105"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab("commissions")}
              className={`px-6 py-3 rounded-lg text-lg font-semibold transition-all duration-200 ${
                activeTab === "commissions"
                  ? "bg-blue-600 text-white shadow-lg transform scale-105"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              Commission Structures
            </button>
          </div>
        </div>

        {/* Positions Tab */}
        {activeTab === "positions" && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900">Positions</h2>
                <AddPositionModal
                  onPositionCreated={handlePositionCreated}
                  trigger={
                    <Button size="lg" className="flex items-center gap-3 px-6 py-3 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg">
                      <Plus className="h-5 w-5" />
                      Add Position
                    </Button>
                  }
                />
              </div>
            </div>
            <div className="p-8">
              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full text-lg bg-white">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="text-left py-4 px-6 font-bold text-gray-800">Title</th>
                      <th className="text-left py-4 px-6 font-bold text-gray-800">Priority</th>
                      <th className="text-left py-4 px-6 font-bold text-gray-800">Base Commission Rate</th>
                      <th className="text-left py-4 px-6 font-bold text-gray-800">Status</th>
                      <th className="text-right py-4 px-6 font-bold text-gray-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xl text-gray-600 font-medium">
                          Loading...
                        </td>
                      </tr>
                    ) : positions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xl text-gray-600 font-medium">
                          No positions found
                        </td>
                      </tr>
                    ) : (
                      positions.map((position: Position) => (
                        <tr key={position.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150">
                          {/* Title Column */}
                          <td className="py-5 px-6 text-gray-900 font-medium">
                            {editingPositionId === position.id ? (
                              <Input
                                type="text"
                                value={editFormData.name}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="h-10 text-lg"
                              />
                            ) : (
                              position.name
                            )}
                          </td>

                          {/* Priority Column */}
                          <td className="py-5 px-6 text-gray-900 font-medium">
                            {editingPositionId === position.id ? (
                              <Input
                                type="number"
                                value={editFormData.level}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, level: e.target.value }))}
                                className="h-10 w-24 text-lg"
                                min="0"
                                step="1"
                              />
                            ) : (
                              position.level
                            )}
                          </td>

                          {/* Base Commission Rate Column */}
                          <td className="py-5 px-6 text-gray-900 font-medium">
                            {editingPositionId === position.id ? (
                              <Input
                                type="number"
                                value={editFormData.base_commission_rate}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, base_commission_rate: e.target.value }))}
                                className="h-10 w-24 text-lg"
                                min="0"
                                max="200"
                                step="0.01"
                                placeholder="0.00"
                              />
                            ) : (
                              position.base_commission_rate ? `${position.base_commission_rate}%` : "N/A"
                            )}
                          </td>

                          {/* Status Column */}
                          <td className="py-5 px-6">
                            {editingPositionId === position.id ? (
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={editFormData.is_active}
                                  onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, is_active: checked }))}
                                />
                                <span className="text-lg text-gray-700 font-medium">
                                  {editFormData.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            ) : (
                              <span className={`px-3 py-2 rounded-full text-sm font-bold ${
                                position.is_active
                                  ? "bg-green-100 text-green-800 border border-green-300"
                                  : "bg-red-100 text-red-800 border border-red-300"
                              }`}>
                                {position.is_active ? "Active" : "Inactive"}
                              </span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="py-5 px-6">
                            <div className="flex items-center justify-end space-x-3">
                              {editingPositionId === position.id ? (
                                <>
                                  <button
                                    onClick={handleSaveEdit}
                                    disabled={updating}
                                    className="text-green-600 hover:text-green-800 p-2 disabled:opacity-50 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                  >
                                    <Check className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    disabled={updating}
                                    className="text-gray-600 hover:text-gray-800 p-2 disabled:opacity-50 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <X className="h-5 w-5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditPosition(position)}
                                    className="text-blue-600 hover:text-blue-800 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                  >
                                    <Edit className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePosition(position)}
                                    className="text-red-600 hover:text-red-800 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="space-y-8">
            {/* Carrier Selection */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-3xl font-bold text-gray-900">Select Carrier</h2>
              </div>
              <div className="p-8">
                {carriersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-xl text-gray-600 font-medium">Loading...</span>
                  </div>
                ) : (
                  <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                    <SelectTrigger className="w-80 h-12 text-lg border-2 border-gray-300 rounded-lg bg-white text-gray-900">
                      <SelectValue placeholder="Choose a carrier" className="text-gray-900" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 shadow-lg text-gray-900">
                      {carriers.map((carrier) => (
                        <SelectItem key={carrier.id} value={carrier.id} className="text-lg py-3 text-gray-900 hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-gray-900">
                          {carrier.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Products List */}
            {selectedCarrier && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <div className="p-8 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900">
                      Products for {carriers.find(c => c.id === selectedCarrier)?.display_name}
                    </h2>
                    <AddProductModal
                      carrierId={selectedCarrier}
                      onProductCreated={handleProductCreated}
                      trigger={
                        <Button size="lg" className="flex items-center gap-3 px-6 py-3 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg">
                          <Plus className="h-5 w-5" />
                          Add Product
                        </Button>
                      }
                    />
                  </div>
                </div>
                <div className="p-8">
                  {productsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <span className="text-xl text-gray-600 font-medium">Loading...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                      <table className="w-full text-lg bg-white">
                        <thead>
                          <tr className="border-b-2 border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100">
                            <th className="text-left py-4 px-6 font-bold text-gray-800">Product Name</th>
                            <th className="text-left py-4 px-6 font-bold text-gray-800">Product Code</th>
                            <th className="text-left py-4 px-6 font-bold text-gray-800">Status</th>
                            <th className="text-right py-4 px-6 font-bold text-gray-800">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-12 text-center text-xl text-gray-600 font-medium">
                                No products found for this carrier
                              </td>
                            </tr>
                          ) : (
                            products.map((product: Product) => (
                              <tr key={product.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150">
                                {/* Product Name Column */}
                                <td className="py-5 px-6 text-gray-900 font-medium">
                                  {editingProductId === product.id ? (
                                    <Input
                                      type="text"
                                      value={editProductFormData.name}
                                      onChange={(e) => setEditProductFormData(prev => ({ ...prev, name: e.target.value }))}
                                      className="h-10 text-lg"
                                    />
                                  ) : (
                                    product.name
                                  )}
                                </td>

                                {/* Product Code Column */}
                                <td className="py-5 px-6 text-gray-900 font-medium">
                                  {editingProductId === product.id ? (
                                    <Input
                                      type="text"
                                      value={editProductFormData.product_code}
                                      onChange={(e) => setEditProductFormData(prev => ({ ...prev, product_code: e.target.value }))}
                                      className="h-10 text-lg"
                                      placeholder="N/A"
                                    />
                                  ) : (
                                    product.product_code || "N/A"
                                  )}
                                </td>

                                {/* Status Column */}
                                <td className="py-5 px-6">
                                  {editingProductId === product.id ? (
                                    <div className="flex items-center space-x-3">
                                      <Checkbox
                                        checked={editProductFormData.is_active}
                                        onCheckedChange={(checked) => setEditProductFormData(prev => ({ ...prev, is_active: checked }))}
                                      />
                                      <span className="text-lg text-gray-700 font-medium">
                                        {editProductFormData.is_active ? "Active" : "Inactive"}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className={`px-3 py-2 rounded-full text-sm font-bold ${
                                      product.is_active
                                        ? "bg-green-100 text-green-800 border border-green-300"
                                        : "bg-red-100 text-red-800 border border-red-300"
                                    }`}>
                                      {product.is_active ? "Active" : "Inactive"}
                                    </span>
                                  )}
                                </td>

                                {/* Actions Column */}
                                <td className="py-5 px-6">
                                  <div className="flex items-center justify-end space-x-3">
                                    {editingProductId === product.id ? (
                                      <>
                                        <button
                                          onClick={handleSaveProductEdit}
                                          disabled={updatingProduct}
                                          className="text-green-600 hover:text-green-800 p-2 disabled:opacity-50 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                        >
                                          <Check className="h-5 w-5" />
                                        </button>
                                        <button
                                          onClick={handleCancelProductEdit}
                                          disabled={updatingProduct}
                                          className="text-gray-600 hover:text-gray-800 p-2 disabled:opacity-50 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                          <X className="h-5 w-5" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleEditProduct(product)}
                                          className="text-blue-600 hover:text-blue-800 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                        >
                                          <Edit className="h-5 w-5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteProduct(product)}
                                          className="text-red-600 hover:text-red-800 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                          <Trash2 className="h-5 w-5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                            </tr>
                          ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Commission Structures Tab */}
        {activeTab === "commissions" && (
          <div className="space-y-8">
            {/* Carrier and Product Selection */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-3xl font-bold text-gray-900">Select Carrier and Product</h2>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xl font-bold text-gray-800 mb-4">Carrier</label>
                  <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                    <SelectTrigger className="w-80 h-12 text-lg border-2 border-gray-300 rounded-lg bg-white text-gray-900">
                      <SelectValue placeholder="Choose a carrier" className="text-gray-900" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 shadow-lg text-gray-900">
                      {carriers.map((carrier) => (
                        <SelectItem key={carrier.id} value={carrier.id} className="text-lg py-3 text-gray-900 hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-gray-900">
                          {carrier.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCarrier && (
                  <div>
                    <label className="block text-xl font-bold text-gray-800 mb-4">Product</label>
                    {allProducts.filter(product => product.carrier_id === selectedCarrier).length === 0 ? (
                      <Select disabled>
                        <SelectTrigger className="w-80 h-12 opacity-50 cursor-not-allowed text-lg border-2 border-gray-300 rounded-lg bg-gray-100 text-gray-500">
                          <SelectValue placeholder="No products available for this carrier" />
                        </SelectTrigger>
                      </Select>
                    ) : (
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger className="w-80 h-12 text-lg border-2 border-gray-300 rounded-lg bg-white text-gray-900">
                          <SelectValue placeholder="Choose a product" className="text-gray-900" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-300 shadow-lg text-gray-900">
                          {allProducts
                            .filter(product => product.carrier_id === selectedCarrier)
                            .map((product) => (
                            <SelectItem key={product.id} value={product.id} className="text-lg py-3 text-gray-900 hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-gray-900">
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {selectedCarrier && selectedProduct && (
                  <div>
                    <label className="block text-xl font-bold text-gray-800 mb-4">Commission Type</label>
                    <Select value={selectedCommissionType} onValueChange={setSelectedCommissionType}>
                      <SelectTrigger className="w-80 h-12 text-lg border-2 border-gray-300 rounded-lg bg-white text-gray-900">
                        <SelectValue placeholder="Choose commission type" className="text-gray-900" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-300 shadow-lg text-gray-900">
                        <SelectItem value="initial" className="text-lg py-3 text-gray-900 hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-gray-900">Initial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Commission Percentages */}
            {selectedCarrier && selectedProduct && selectedCommissionType && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <div className="p-8 border-b border-gray-200">
                  <h2 className="text-3xl font-bold text-gray-900">
                    Commission Percentages for {allProducts.find(p => p.id === selectedProduct)?.name} ({selectedCommissionType})
                  </h2>
                </div>
                <div className="p-8">
                  {commissionStructuresLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <span className="text-xl text-gray-600 font-medium">Loading commission structures...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                      <table className="w-full text-lg bg-white">
                        <thead>
                          <tr className="border-b-2 border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100">
                            <th className="text-left py-4 px-6 font-bold text-gray-800">Position</th>
                            <th className="text-left py-4 px-6 font-bold text-gray-800">Commission %</th>
                            <th className="text-right py-4 px-6 font-bold text-gray-800">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {positions.map((position: Position) => {
                            const existingStructure = commissionStructures.find(
                              cs => cs.position_id === position.id
                            )
                            const inputValue = commissionInputValues[position.id] || ""
                            const originalValue = originalCommissionValues[position.id] || ""
                            const hasChanges = inputValue !== originalValue
                            const isLoading = Boolean(savingCommissions[position.id])

                            return (
                              <tr key={position.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150">
                                <td className="py-5 px-6 text-gray-900 font-medium text-lg">{position.name}</td>
                                <td className="py-5 px-6">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-32 h-12 text-lg border-2 border-gray-300 rounded-lg"
                                    value={inputValue}
                                    onChange={(e) => setCommissionInputValues(prev => ({
                                      ...prev,
                                      [position.id]: e.target.value
                                    }))}
                                    disabled={isLoading}
                                  />
                                </td>
                                <td className="py-5 px-6">
                                  <div className="flex items-center justify-end">
                                    <Button
                                      size="lg"
                                      variant="outline"
                                      className="h-12 px-6 text-lg font-semibold border-2"
                                      disabled={!inputValue || parseFloat(inputValue) < 0 || !hasChanges || isLoading}
                                      onClick={() => handleSaveCommission(position.id)}
                                    >
                                      {isLoading ? 'Saving...' : (existingStructure ? 'Update' : 'Save')}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Position</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete the position "{positionToDelete?.name}"? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleting}
            >
              No
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Delete Confirmation Modal */}
      <Dialog open={deleteProductConfirmOpen} onOpenChange={setDeleteProductConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete the product "{productToDelete?.name}"? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleCancelProductDelete}
              disabled={deletingProduct}
            >
              No
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmProductDelete}
              disabled={deletingProduct}
            >
              {deletingProduct ? 'Deleting...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}