"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Plus, Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import AddProductModal from "@/components/modals/add-product-modal"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

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

// Types for agency data
interface Agency {
  id: string
  name: string
  lead_sources?: string[]
}

export default function ConfigurationPage() {
  const [selectedCarrier, setSelectedCarrier] = useState<string>("")
  const [productsModalOpen, setProductsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"carriers" | "lead-sources">("carriers")

  // Lead Sources state
  const [agency, setAgency] = useState<Agency | null>(null)
  const [leadSources, setLeadSources] = useState<string[]>([])
  const [newLeadSource, setNewLeadSource] = useState("")
  const [editingLeadSourceIndex, setEditingLeadSourceIndex] = useState<number | null>(null)
  const [editLeadSourceValue, setEditLeadSourceValue] = useState("")
  const [savingLeadSources, setSavingLeadSources] = useState(false)

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

  // Load data on mount
  useEffect(() => {
    if (!carriersLoaded || !allProductsLoaded) {
      fetchAllData()
    }
  }, [carriersLoaded, allProductsLoaded])

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
  }, [selectedCarrier])

  const fetchAllData = async () => {
    try {
      // Get the current user's session to get the access token
      const { data: { session } } = await createClient().auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('No access token available. Please log in again.')
      }

      setCarriersLoading(true)
      setProductsLoading(true)

      // Also fetch the current user's agency info
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      let agencyData: Agency | null = null
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('agency_id')
          .eq('auth_user_id', user.id)
          .single()

        if (userData?.agency_id) {
          const { data: agencyInfo } = await supabase
            .from('agencies')
            .select('id, name, lead_sources')
            .eq('id', userData.agency_id)
            .single()

          if (agencyInfo) {
            agencyData = agencyInfo
            setAgency(agencyInfo)
            setLeadSources(agencyInfo.lead_sources || [])
          }
        }
      }

      const [carriersResponse, productsResponse] = await Promise.all([
        fetch('/api/carriers', {
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
      ])

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

    } catch (error) {
      console.error('Error fetching data:', error)
      // Show error to user - you might want to add a toast notification here
      alert(`Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCarriersLoading(false)
      setProductsLoading(false)
    }
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
          const response = await fetch('/api/carriers', {
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
            const carriersResponse = await fetch('/api/carriers', {
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

  const handleCarrierClick = (carrierId: string) => {
    setSelectedCarrier(carrierId)
    setProductsModalOpen(true)
  }

  const handleCloseProductsModal = () => {
    setProductsModalOpen(false)
    setEditingProductId(null)
    setEditProductFormData({ name: "", product_code: "", is_active: true })
    setOriginalProductData(null)
  }

  // Lead Sources Management Functions
  const handleAddLeadSource = async () => {
    if (!newLeadSource.trim() || !agency) return

    const updatedLeadSources = [...leadSources, newLeadSource.trim()]

    try {
      setSavingLeadSources(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ lead_sources: updatedLeadSources })
        .eq('id', agency.id)

      if (error) throw error

      setLeadSources(updatedLeadSources)
      setNewLeadSource("")
    } catch (error) {
      console.error('Error adding lead source:', error)
      alert('Failed to add lead source')
    } finally {
      setSavingLeadSources(false)
    }
  }

  const handleEditLeadSource = (index: number) => {
    setEditingLeadSourceIndex(index)
    setEditLeadSourceValue(leadSources[index])
  }

  const handleSaveLeadSourceEdit = async () => {
    if (editingLeadSourceIndex === null || !editLeadSourceValue.trim() || !agency) return

    const updatedLeadSources = [...leadSources]
    updatedLeadSources[editingLeadSourceIndex] = editLeadSourceValue.trim()

    try {
      setSavingLeadSources(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ lead_sources: updatedLeadSources })
        .eq('id', agency.id)

      if (error) throw error

      setLeadSources(updatedLeadSources)
      setEditingLeadSourceIndex(null)
      setEditLeadSourceValue("")
    } catch (error) {
      console.error('Error updating lead source:', error)
      alert('Failed to update lead source')
    } finally {
      setSavingLeadSources(false)
    }
  }

  const handleCancelLeadSourceEdit = () => {
    setEditingLeadSourceIndex(null)
    setEditLeadSourceValue("")
  }

  const handleDeleteLeadSource = async (index: number) => {
    if (!agency) return

    const confirmed = window.confirm(`Are you sure you want to delete "${leadSources[index]}"?`)
    if (!confirmed) return

    const updatedLeadSources = leadSources.filter((_, i) => i !== index)

    try {
      setSavingLeadSources(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ lead_sources: updatedLeadSources })
        .eq('id', agency.id)

      if (error) throw error

      setLeadSources(updatedLeadSources)
    } catch (error) {
      console.error('Error deleting lead source:', error)
      alert('Failed to delete lead source')
    } finally {
      setSavingLeadSources(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-10 bg-card rounded-xl shadow-lg p-8 border border-border">
          <h1 className="text-5xl font-bold text-foreground mb-4">Configuration</h1>
          <p className="text-xl text-muted-foreground">Manage products and lead sources</p>
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-xl shadow-lg border border-border">
          {/* Tab Headers */}
          <div className="border-b border-border">
            <div className="flex">
              <button
                onClick={() => setActiveTab("carriers")}
                className={cn(
                  "flex-1 px-8 py-6 text-lg font-semibold transition-all",
                  activeTab === "carriers"
                    ? "bg-blue-50 text-blue-700 border-b-4 border-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Carriers & Products
              </button>
              <button
                onClick={() => setActiveTab("lead-sources")}
                className={cn(
                  "flex-1 px-8 py-6 text-lg font-semibold transition-all",
                  activeTab === "lead-sources"
                    ? "bg-blue-50 text-blue-700 border-b-4 border-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Lead Sources
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {/* Carriers Tab */}
            {activeTab === "carriers" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-3xl font-bold text-foreground mb-2">Select Carrier</h2>
                  <p className="text-sm text-muted-foreground">Choose a carrier to manage its products</p>
                </div>
                {carriersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="text-xl text-muted-foreground font-medium">Loading carriers...</span>
                  </div>
                ) : carriers.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="text-xl text-muted-foreground font-medium">No carriers available</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {carriers.map((carrier) => (
                      <button
                        key={carrier.id}
                        onClick={() => handleCarrierClick(carrier.id)}
                        className="group relative bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-500 rounded-xl p-6 transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-100"
                      >
                        <div className="flex items-center justify-center h-24">
                          <span className="text-lg font-semibold text-gray-800 group-hover:text-blue-700 text-center">
                            {carrier.display_name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Lead Sources Tab */}
            {activeTab === "lead-sources" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-3xl font-bold text-foreground mb-2">Lead Sources</h2>
                  <p className="text-sm text-muted-foreground">Configure the lead source options available for your agency</p>
                </div>

                {/* Add New Lead Source */}
                <div className="flex gap-3 mb-6">
                  <Input
                    type="text"
                    value={newLeadSource}
                    onChange={(e) => setNewLeadSource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLeadSource.trim()) {
                        handleAddLeadSource()
                      }
                    }}
                    placeholder="Enter new lead source (e.g., Facebook, Referral)"
                    className="flex-1 h-12 text-lg"
                    disabled={savingLeadSources}
                  />
                  <Button
                    onClick={handleAddLeadSource}
                    disabled={!newLeadSource.trim() || savingLeadSources}
                    className="h-12 px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add
                  </Button>
                </div>

                {/* Lead Sources List */}
                <div className="space-y-3">
                  {leadSources.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No lead sources configured. Add one above to get started.
                    </div>
                  ) : (
                    leadSources.map((source, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg border border-border"
                      >
                        {editingLeadSourceIndex === index ? (
                          <>
                            <Input
                              type="text"
                              value={editLeadSourceValue}
                              onChange={(e) => setEditLeadSourceValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLeadSourceEdit()
                                if (e.key === 'Escape') handleCancelLeadSourceEdit()
                              }}
                              className="flex-1 h-10"
                              disabled={savingLeadSources}
                            />
                            <button
                              onClick={handleSaveLeadSourceEdit}
                              disabled={savingLeadSources || !editLeadSourceValue.trim()}
                              className="text-green-600 hover:text-green-800 p-2 disabled:opacity-50 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={handleCancelLeadSourceEdit}
                              disabled={savingLeadSources}
                              className="text-muted-foreground hover:text-foreground p-2 disabled:opacity-50 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-lg font-medium text-foreground">{source}</span>
                            <button
                              onClick={() => handleEditLeadSource(index)}
                              disabled={savingLeadSources}
                              className="text-blue-600 hover:text-blue-800 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLeadSource(index)}
                              disabled={savingLeadSources}
                              className="text-red-600 hover:text-red-800 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Products Modal */}
        <Dialog open={productsModalOpen} onOpenChange={handleCloseProductsModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-3xl font-bold text-foreground">
                  Products for {carriers.find(c => c.id === selectedCarrier)?.display_name}
                </DialogTitle>
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
            </DialogHeader>
            <div className="flex-1 overflow-y-auto mt-4">
              {productsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="text-xl text-muted-foreground font-medium">Loading products...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
                  <table className="w-full text-lg bg-card">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b-2 border-border bg-gradient-to-r from-gray-50 to-gray-100">
                        <th className="text-left py-4 px-6 font-bold text-gray-800">Product Name</th>
                        <th className="text-left py-4 px-6 font-bold text-gray-800">Product Code</th>
                        <th className="text-left py-4 px-6 font-bold text-gray-800">Status</th>
                        <th className="text-right py-4 px-6 font-bold text-gray-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-xl text-muted-foreground font-medium">
                            No products found for this carrier
                          </td>
                        </tr>
                      ) : (
                        products.map((product: Product) => (
                          <tr key={product.id} className="border-b border-border hover:bg-blue-50 transition-colors duration-150">
                            {/* Product Name Column */}
                            <td className="py-5 px-6 text-foreground font-medium">
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
                            <td className="py-5 px-6 text-foreground font-medium">
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
                                    onCheckedChange={(checked) => setEditProductFormData(prev => ({ ...prev, is_active: checked as boolean }))}
                                  />
                                  <span className="text-lg text-muted-foreground font-medium">
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
                                      className="text-muted-foreground hover:text-foreground p-2 disabled:opacity-50 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
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
          </DialogContent>
        </Dialog>

        {/* Product Delete Confirmation Modal */}
        <Dialog open={deleteProductConfirmOpen} onOpenChange={setDeleteProductConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Product</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-muted-foreground">
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
