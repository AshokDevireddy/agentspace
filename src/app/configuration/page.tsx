"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Plus, Check, X, Upload, FileText, TrendingUp, Loader2 } from "lucide-react"
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
  phone_number?: string
  messaging_enabled?: boolean
  discord_webhook_url?: string
}

export default function ConfigurationPage() {
  const [selectedCarrier, setSelectedCarrier] = useState<string>("")
  const [productsModalOpen, setProductsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"carriers" | "lead-sources" | "messaging" | "policy-reports" | "discord">("carriers")

  // Lead Sources state
  const [agency, setAgency] = useState<Agency | null>(null)
  const [leadSources, setLeadSources] = useState<string[]>([])
  const [newLeadSource, setNewLeadSource] = useState("")
  const [editingLeadSourceIndex, setEditingLeadSourceIndex] = useState<number | null>(null)
  const [editLeadSourceValue, setEditLeadSourceValue] = useState("")
  const [savingLeadSources, setSavingLeadSources] = useState(false)

  // SMS Settings state
  const [agencyPhoneNumber, setAgencyPhoneNumber] = useState<string>("")
  const [editingPhoneNumber, setEditingPhoneNumber] = useState(false)
  const [phoneNumberValue, setPhoneNumberValue] = useState("")
  const [savingPhoneNumber, setSavingPhoneNumber] = useState(false)

  // Messaging Settings state
  const [messagingEnabled, setMessagingEnabled] = useState<boolean>(false)
  const [savingMessagingEnabled, setSavingMessagingEnabled] = useState(false)

  // Discord Settings state
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>("")
  const [editingDiscordWebhook, setEditingDiscordWebhook] = useState(false)
  const [discordWebhookValue, setDiscordWebhookValue] = useState("")
  const [savingDiscordWebhook, setSavingDiscordWebhook] = useState(false)

  // Policy Reports state
  const [uploads, setUploads] = useState<Array<{carrier: string, file: File | null}>>([
    { carrier: 'Aetna', file: null },
    { carrier: 'Aflac', file: null },
    { carrier: 'American Amicable', file: null },
    { carrier: 'Combined Insurance', file: null },
    { carrier: 'American Home Life', file: null },
    { carrier: 'Royal Neighbors', file: null },
    { carrier: 'Liberty Bankers Life', file: null }
  ])
  const [uploadingReports, setUploadingReports] = useState(false)
  const [uploadedFilesInfo, setUploadedFilesInfo] = useState<any[]>([])
  const [checkingExistingFiles, setCheckingExistingFiles] = useState(false)

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

  // Check for existing policy files when policy reports tab is opened
  useEffect(() => {
    if (activeTab === 'policy-reports') {
      checkExistingPolicyFiles()
    }
  }, [activeTab])

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
      // Get the current user to verify authentication
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated. Please log in again.')
      }

      // Get session for access token
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('No access token available. Please log in again.')
      }

      setCarriersLoading(true)
      setProductsLoading(true)

      // Fetch the current user's agency info
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
            .select('id, name, lead_sources, phone_number, messaging_enabled, discord_webhook_url')
            .eq('id', userData.agency_id)
            .single()

          if (agencyInfo) {
            agencyData = agencyInfo
            setAgency(agencyInfo)
            setLeadSources(agencyInfo.lead_sources || [])
            setAgencyPhoneNumber(agencyInfo.phone_number || "")
            setMessagingEnabled(agencyInfo.messaging_enabled || false)
            setDiscordWebhookUrl(agencyInfo.discord_webhook_url || "")
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
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
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
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
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

  // SMS Settings Management Functions
  const handleEditPhoneNumber = () => {
    setEditingPhoneNumber(true)
    setPhoneNumberValue(agencyPhoneNumber)
  }

  const handleSavePhoneNumber = async () => {
    if (!agency) return

    try {
      setSavingPhoneNumber(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ phone_number: phoneNumberValue.trim() || null })
        .eq('id', agency.id)

      if (error) throw error

      setAgencyPhoneNumber(phoneNumberValue.trim())
      setEditingPhoneNumber(false)
      setPhoneNumberValue("")
    } catch (error) {
      console.error('Error updating phone number:', error)
      alert('Failed to update phone number')
    } finally {
      setSavingPhoneNumber(false)
    }
  }

  const handleCancelPhoneNumberEdit = () => {
    setEditingPhoneNumber(false)
    setPhoneNumberValue("")
  }

  // Messaging Settings Management Functions
  const handleToggleMessaging = async (enabled: boolean) => {
    if (!agency) return

    try {
      setSavingMessagingEnabled(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ messaging_enabled: enabled })
        .eq('id', agency.id)

      if (error) throw error

      setMessagingEnabled(enabled)
    } catch (error) {
      console.error('Error updating messaging settings:', error)
      alert('Failed to update messaging settings')
      // Revert the toggle on error
      setMessagingEnabled(!enabled)
    } finally {
      setSavingMessagingEnabled(false)
    }
  }

  // Discord Webhook Management Functions
  const handleEditDiscordWebhook = () => {
    setEditingDiscordWebhook(true)
    setDiscordWebhookValue(discordWebhookUrl)
  }

  const handleSaveDiscordWebhook = async () => {
    if (!agency) return

    try {
      setSavingDiscordWebhook(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ discord_webhook_url: discordWebhookValue.trim() || null })
        .eq('id', agency.id)

      if (error) throw error

      setDiscordWebhookUrl(discordWebhookValue.trim())
      setEditingDiscordWebhook(false)
      setDiscordWebhookValue("")
    } catch (error) {
      console.error('Error updating Discord webhook:', error)
      alert('Failed to update Discord webhook URL')
    } finally {
      setSavingDiscordWebhook(false)
    }
  }

  const handleCancelDiscordWebhookEdit = () => {
    setEditingDiscordWebhook(false)
    setDiscordWebhookValue("")
  }

  // Policy Reports Management Functions
  const checkExistingPolicyFiles = async () => {
    try {
      setCheckingExistingFiles(true)
      const response = await fetch('/api/upload-policy-reports/bucket', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.files && data.files.length > 0) {
          setUploadedFilesInfo(data.files)
        }
      }
    } catch (error) {
      console.error('Error checking existing files:', error)
    } finally {
      setCheckingExistingFiles(false)
    }
  }

  const handleFileUpload = (carrierIndex: number, file: File) => {
    const newUploads = [...uploads]
    newUploads[carrierIndex] = {
      ...newUploads[carrierIndex],
      file: file
    }
    setUploads(newUploads)
  }

  const handleFileRemove = (carrierIndex: number) => {
    const newUploads = [...uploads]
    newUploads[carrierIndex] = {
      ...newUploads[carrierIndex],
      file: null
    }
    setUploads(newUploads)
  }

  const handleAnalyzePersistency = async () => {
    const uploadedFiles = uploads.filter(upload => upload.file !== null)
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one policy report before analyzing.')
      return
    }

    try {
      setUploadingReports(true)

      const formData = new FormData()

      uploadedFiles.forEach((upload) => {
        if (upload.file) {
          formData.append(`carrier_${upload.carrier}`, upload.file)
        }
      })

      // Call both bucket and staging APIs in parallel
      const [bucketResponse, stagingResponse] = await Promise.all([
        fetch('/api/upload-policy-reports/bucket', {
          method: 'POST',
          body: formData,
        }),
        fetch('/api/upload-policy-reports/staging', {
          method: 'POST',
          body: formData,
        })
      ])

      const bucketResult = await bucketResponse.json()
      const stagingResult = await stagingResponse.json()

      // Handle results
      if (bucketResult.success && stagingResult.success) {
        alert(`Successfully uploaded files and processed ${stagingResult.totalRecordsInserted} policy records!`)
        // Clear uploaded files after successful processing
        setUploads(uploads.map(u => ({ carrier: u.carrier, file: null })))
        // Refresh existing files
        checkExistingPolicyFiles()
      } else {
        const errors = [
          ...(bucketResult.errors || []),
          ...(stagingResult.errors || [])
        ]
        alert(`Upload failed: ${errors.join(', ')}`)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('An error occurred while uploading files. Please try again.')
    } finally {
      setUploadingReports(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage products and lead sources</p>
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-lg shadow-sm border border-border">
          {/* Tab Headers */}
          <div className="border-b border-border">
            <div className="flex">
              <button
                onClick={() => setActiveTab("carriers")}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-all",
                  activeTab === "carriers"
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Carriers & Products
              </button>
              <button
                onClick={() => setActiveTab("lead-sources")}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-all",
                  activeTab === "lead-sources"
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Lead Sources
              </button>
              <button
                onClick={() => setActiveTab("messaging")}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-all",
                  activeTab === "messaging"
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Messaging
              </button>
              <button
                onClick={() => setActiveTab("policy-reports")}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-all",
                  activeTab === "policy-reports"
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Policy Reports
              </button>
              <button
                onClick={() => setActiveTab("discord")}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-all",
                  activeTab === "discord"
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Discord Notifications
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Carriers Tab */}
            {activeTab === "carriers" && (
              <div>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground mb-1">Select Carrier</h2>
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
                        className="group relative bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-500 rounded-lg p-6 transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-100"
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
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground mb-1">Lead Sources</h2>
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

            {/* Messaging Tab (Combined SMS Settings + Messaging) */}
            {activeTab === "messaging" && (
              <div>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground mb-1">Messaging</h2>
                  <p className="text-sm text-muted-foreground">Configure SMS settings and control automated messaging for your agency</p>
                </div>

                <div className="space-y-6">
                  {/* Agency Phone Number */}
                  <div className="bg-accent/30 rounded-lg p-6 border border-border">
                    <h3 className="text-xl font-semibold text-foreground mb-4">Agency Phone Number</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This is the phone number your agents will use to send SMS messages to clients via Telnyx.
                      Enter the number in E.164 format (e.g., +12345678900).
                    </p>

                    {editingPhoneNumber ? (
                      <div className="flex gap-3">
                        <Input
                          type="tel"
                          value={phoneNumberValue}
                          onChange={(e) => setPhoneNumberValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePhoneNumber()
                            if (e.key === 'Escape') handleCancelPhoneNumberEdit()
                          }}
                          placeholder="+12345678900"
                          className="flex-1 h-12 text-lg font-mono"
                          disabled={savingPhoneNumber}
                        />
                        <button
                          onClick={handleSavePhoneNumber}
                          disabled={savingPhoneNumber}
                          className="text-green-600 hover:text-green-800 p-3 disabled:opacity-50 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <Check className="h-6 w-6" />
                        </button>
                        <button
                          onClick={handleCancelPhoneNumberEdit}
                          disabled={savingPhoneNumber}
                          className="text-muted-foreground hover:text-foreground p-3 disabled:opacity-50 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 p-4">
                          <p className="text-xl font-mono text-foreground">
                            {agencyPhoneNumber || <span className="text-muted-foreground italic">Not configured</span>}
                          </p>
                        </div>
                        <button
                          onClick={handleEditPhoneNumber}
                          className="text-blue-600 hover:text-blue-800 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Edit className="h-6 w-6" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Setup Instructions */}
                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">Setup Instructions</h3>
                    <ol className="space-y-2 text-sm text-blue-800">
                      <li className="flex gap-2">
                        <span className="font-bold">1.</span>
                        <span>Contact <a href="mailto:ashok@useagentspace.com" className="underline hover:text-blue-900">ashok@useagentspace.com</a> to get a phone number</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">2.</span>
                        <span>Copy the phone number in E.164 format (e.g., +12345678900)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">3.</span>
                        <span>Paste it above and save</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">4.</span>
                        <span>Enable automated messaging below</span>
                      </li>
                    </ol>
                  </div>

                  {/* Messaging Toggle */}
                  <div className="bg-accent/30 rounded-lg p-6 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-2">Enable Automated Messaging</h3>
                        <p className="text-sm text-muted-foreground">
                          When enabled, automated messages will be sent for birthdays, billing reminders, and lapse notifications.
                          When disabled, no automated messages will be sent to your clients.
                        </p>
                        {!agencyPhoneNumber && (
                          <p className="text-sm text-amber-700 mt-2 font-medium">
                            ⚠️ You must configure a phone number above before enabling automated messaging.
                          </p>
                        )}
                      </div>
                      <div className="ml-6">
                        <button
                          onClick={() => handleToggleMessaging(!messagingEnabled)}
                          disabled={savingMessagingEnabled || !agencyPhoneNumber}
                          className={cn(
                            "relative inline-flex h-12 w-24 items-center rounded-full transition-colors duration-200",
                            messagingEnabled ? "bg-green-600" : "bg-gray-300",
                            (savingMessagingEnabled || !agencyPhoneNumber) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-10 w-10 transform rounded-full bg-white shadow-lg transition-transform duration-200",
                              messagingEnabled ? "translate-x-12" : "translate-x-1"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-base font-medium text-foreground">
                        Status: <span className={cn("font-bold", messagingEnabled ? "text-green-600" : "text-gray-500")}>
                          {messagingEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Information Box */}
                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">About Automated Messaging</h3>
                    <p className="text-sm text-blue-800 mb-3">
                      Automated messages include:
                    </p>
                    <ul className="space-y-2 text-sm text-blue-800 list-disc list-inside">
                      <li><strong>Birthday Messages:</strong> Sent daily at 9 AM to clients with birthdays</li>
                      <li><strong>Billing Reminders:</strong> Sent daily at 8 AM, 3 days before premium payments are due</li>
                      <li><strong>Lapse Reminders:</strong> Sent every 2 hours to notify clients about pending policy lapses</li>
                    </ul>
                    <p className="text-sm text-blue-800 mt-3">
                      <strong>Note:</strong> Messages are only sent to clients who have not opted out of SMS communications.
                    </p>
                  </div>

                  {!messagingEnabled && agencyPhoneNumber && (
                    <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                      <h3 className="text-lg font-semibold text-amber-900 mb-2">⚠️ Messaging Currently Disabled</h3>
                      <p className="text-sm text-amber-800">
                        Your clients will not receive any automated messages until you enable messaging above.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Policy Reports Tab */}
            {activeTab === "policy-reports" && (
              <div>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground mb-1">Policy Reports</h2>
                  <p className="text-sm text-muted-foreground">Upload CSV or Excel files for each carrier to analyze persistency rates</p>
                </div>

                {checkingExistingFiles && (
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking for existing uploads...</span>
                  </div>
                )}

                {uploadedFilesInfo.length > 0 && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800">
                      <strong>Note:</strong> Previous uploads detected. New uploads will replace existing files for those carriers.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {uploads.map((upload, index) => (
                    <div key={upload.carrier} className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-700 text-center">
                        {upload.carrier}
                      </h3>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center hover:border-gray-400 transition-colors">
                        {upload.file ? (
                          <div className="text-center">
                            <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              {upload.file.name}
                            </p>
                            <p className="text-xs text-gray-500 mb-4">
                              {(upload.file.size / 1024).toFixed(2)} KB
                            </p>
                            <Button
                              onClick={() => handleFileRemove(index)}
                              className="bg-black text-white hover:bg-gray-800 px-4 py-2 text-sm"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-700 mb-1">
                              Click to upload
                            </p>
                            <p className="text-xs text-gray-500 mb-4">
                              CSV or Excel file
                            </p>
                            <input
                              type="file"
                              accept=".csv,.xlsx,.xls"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileUpload(index, file)
                              }}
                              className="hidden"
                              id={`upload-config-${index}`}
                            />
                            <label
                              htmlFor={`upload-config-${index}`}
                              className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-sm text-gray-700 inline-block transition-colors"
                            >
                              Choose File
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleAnalyzePersistency}
                    disabled={uploadingReports || uploads.every(u => u.file === null)}
                    className="bg-black text-white hover:bg-gray-800 px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingReports ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-5 w-5 mr-2" />
                        Analyze Persistency
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-amber-900 mb-2">Instructions</h3>
                  <ul className="space-y-1 text-sm text-amber-800 list-disc list-inside">
                    <li>Upload CSV or Excel files containing your policy data for each carrier</li>
                    <li>Files will be processed to calculate persistency rates and track policy status</li>
                    <li>New uploads will replace any existing files for the same carrier</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Discord Tab */}
            {activeTab === "discord" && (
              <div>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground mb-1">Discord Notifications</h2>
                  <p className="text-sm text-muted-foreground">Configure Discord webhook to get notified when deals are posted</p>
                </div>

                <div className="space-y-6">
                  {/* Discord Webhook URL */}
                  <div className="bg-accent/30 rounded-lg p-6 border border-border">
                    <h3 className="text-xl font-semibold text-foreground mb-4">Discord Webhook URL</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Enter your Discord webhook URL to receive notifications when agents post deals.
                      Each notification will include the agent's name, deal details, and deal value.
                    </p>

                    {editingDiscordWebhook ? (
                      <div className="flex gap-3">
                        <Input
                          type="url"
                          value={discordWebhookValue}
                          onChange={(e) => setDiscordWebhookValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveDiscordWebhook()
                            if (e.key === 'Escape') handleCancelDiscordWebhookEdit()
                          }}
                          placeholder="https://discord.com/api/webhooks/..."
                          className="flex-1 h-12 text-sm font-mono"
                          disabled={savingDiscordWebhook}
                        />
                        <button
                          onClick={handleSaveDiscordWebhook}
                          disabled={savingDiscordWebhook}
                          className="text-green-600 hover:text-green-800 p-3 disabled:opacity-50 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <Check className="h-6 w-6" />
                        </button>
                        <button
                          onClick={handleCancelDiscordWebhookEdit}
                          disabled={savingDiscordWebhook}
                          className="text-muted-foreground hover:text-foreground p-3 disabled:opacity-50 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 p-4">
                          <p className="text-sm font-mono text-foreground break-all">
                            {discordWebhookUrl || <span className="text-muted-foreground italic">Not configured</span>}
                          </p>
                        </div>
                        <button
                          onClick={handleEditDiscordWebhook}
                          className="text-blue-600 hover:text-blue-800 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Edit className="h-6 w-6" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Setup Instructions */}
                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Set Up Discord Webhook</h3>
                    <ol className="space-y-2 text-sm text-blue-800">
                      <li className="flex gap-2">
                        <span className="font-bold">1.</span>
                        <span>Open Discord and navigate to the channel where you want to receive notifications</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">2.</span>
                        <span>Click the gear icon (⚙️) next to the channel name to edit the channel</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">3.</span>
                        <span>Go to <strong>Integrations</strong> → <strong>Webhooks</strong> → <strong>New Webhook</strong></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">4.</span>
                        <span>Give your webhook a name (e.g., "Deal Notifications")</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">5.</span>
                        <span>Click <strong>Copy Webhook URL</strong></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">6.</span>
                        <span>Paste the URL above and save</span>
                      </li>
                    </ol>
                  </div>

                  {/* Notification Example */}
                  <div className="bg-accent/30 rounded-lg p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Notification Example</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      When an agent posts a deal, you'll receive a message like this:
                    </p>
                    <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500 font-mono text-sm">
                      <p className="text-gray-700">
                        🎉 <strong>New Deal Posted!</strong>
                      </p>
                      <p className="text-gray-600 mt-2">
                        <strong>Agent:</strong> John Doe<br />
                        <strong>Client:</strong> Jane Smith<br />
                        <strong>Carrier:</strong> Aetna<br />
                        <strong>Product:</strong> Term Life Insurance<br />
                        <strong>Monthly Premium:</strong> $150.00<br />
                        <strong>Annual Premium:</strong> $1,800.00
                      </p>
                    </div>
                  </div>

                  {!discordWebhookUrl && (
                    <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                      <h3 className="text-lg font-semibold text-amber-900 mb-2">⚠️ No Webhook Configured</h3>
                      <p className="text-sm text-amber-800">
                        You won't receive Discord notifications until you configure a webhook URL above.
                      </p>
                    </div>
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
