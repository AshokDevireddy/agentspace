"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Plus, Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import AddProductModal from "@/components/modals/add-product-modal"
import { createClient } from "@/lib/supabase/client"

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

export default function ConfigurationPage() {
  const [selectedCarrier, setSelectedCarrier] = useState<string>("")

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-10 bg-card rounded-xl shadow-lg p-8 border border-border">
          <h1 className="text-5xl font-bold text-foreground mb-4">Configuration</h1>
          <p className="text-xl text-muted-foreground">Manage products</p>
        </div>

        {/* Products Section */}
        <div className="space-y-8">
          {/* Carrier Selection */}
          <div className="bg-card rounded-xl shadow-lg border border-border">
            <div className="p-8 border-b border-border">
              <h2 className="text-3xl font-bold text-foreground">Select Carrier</h2>
            </div>
            <div className="p-8">
              {carriersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-xl text-muted-foreground font-medium">Loading...</span>
                </div>
              ) : (
                <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                  <SelectTrigger className="w-80 h-12 text-lg border-2 border-border rounded-lg bg-card text-foreground">
                    <SelectValue placeholder="Choose a carrier" className="text-foreground" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border shadow-lg text-foreground">
                    {carriers.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id} className="text-lg py-3 text-foreground hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-foreground">
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
            <div className="bg-card rounded-xl shadow-lg border border-border">
              <div className="p-8 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-foreground">
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
                    <span className="text-xl text-muted-foreground font-medium">Loading...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
                    <table className="w-full text-lg bg-card">
                      <thead>
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
            </div>
          )}
        </div>

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
