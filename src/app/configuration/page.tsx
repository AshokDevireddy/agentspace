"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Plus, Check, X, Upload, FileText, TrendingUp, Loader2, Package, DollarSign, Users, MessageSquare, BarChart3, Bell } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import AddProductModal from "@/components/modals/add-product-modal"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { putToSignedUrl } from '@/lib/upload-policy-reports/client'

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

// Types for position data
interface Position {
  position_id: string
  name: string
  level: number
  description?: string
  is_active: boolean
  created_at?: string
}

// Types for commission data
interface Commission {
  commission_id: string
  position_id: string
  position_name: string
  position_level: number
  product_id: string
  product_name: string
  carrier_id: string
  carrier_name: string
  commission_percentage: number
}

type TabType = "carriers" | "positions" | "commissions" | "lead-sources" | "messaging" | "policy-reports" | "discord"

export default function ConfigurationPage() {
  const [selectedCarrier, setSelectedCarrier] = useState<string>("")
  const [productsModalOpen, setProductsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("carriers")

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
    { carrier: 'Liberty Bankers Life', file: null },
    { carrier: 'Foresters', file: null }
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

  // Positions state
  const [positions, setPositions] = useState<Position[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [newPosition, setNewPosition] = useState({ name: "", level: 0, description: "" })
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null)
  const [editPositionFormData, setEditPositionFormData] = useState<{
    name: string
    level: number
    description: string
    is_active: boolean
  }>({ name: "", level: 0, description: "", is_active: true })
  const [savingPosition, setSavingPosition] = useState(false)
  const [deletePositionConfirmOpen, setDeletePositionConfirmOpen] = useState(false)
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null)
  const [deletingPosition, setDeletingPosition] = useState(false)

  // Commissions state
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [commissionsLoading, setCommissionsLoading] = useState(false)
  const [selectedCommissionCarrier, setSelectedCommissionCarrier] = useState<string>("")
  const [commissionEdits, setCommissionEdits] = useState<Record<string, number>>({})
  const [savingCommissions, setSavingCommissions] = useState(false)

  // Load data on mount
  useEffect(() => {
    if (!carriersLoaded || !allProductsLoaded) {
      fetchAllData()
    }
  }, [carriersLoaded, allProductsLoaded])

  // Check for existing policy files when policy reports tab is opened (only if we haven't checked yet)
  useEffect(() => {
    if (activeTab === 'policy-reports' && uploadedFilesInfo.length === 0 && !checkingExistingFiles) {
      checkExistingPolicyFiles()
    }
  }, [activeTab])

  // Load positions when positions tab is opened
  useEffect(() => {
    if (activeTab === 'positions') {
      fetchPositions()
    }
  }, [activeTab])

  // Load commissions when commissions tab is opened
  useEffect(() => {
    if (activeTab === 'commissions' && !commissionsLoading) {
      fetchCommissions()
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
      alert(`Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCarriersLoading(false)
      setProductsLoading(false)
    }
  }

  const fetchPositions = async () => {
    try {
      setPositionsLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return

      const response = await fetch('/api/positions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPositions(data)
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
    } finally {
      setPositionsLoading(false)
    }
  }

  const fetchCommissions = async (carrierId?: string) => {
    try {
      setCommissionsLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return

      const url = carrierId
        ? `/api/positions/product-commissions?carrier_id=${carrierId}`
        : '/api/positions/product-commissions'

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCommissions(data)
      }
    } catch (error) {
      console.error('Error fetching commissions:', error)
    } finally {
      setCommissionsLoading(false)
    }
  }

  // Position management functions
  const handleAddPosition = async () => {
    if (!newPosition.name.trim() || newPosition.level === 0) {
      alert('Please enter a position name and level')
      return
    }

    try {
      setSavingPosition(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: newPosition.name.trim(),
          level: newPosition.level,
          description: newPosition.description.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create position')
      }

      setNewPosition({ name: "", level: 0, description: "" })
      fetchPositions()
    } catch (error) {
      console.error('Error creating position:', error)
      alert(error instanceof Error ? error.message : 'Failed to create position')
    } finally {
      setSavingPosition(false)
    }
  }

  const handleEditPosition = (position: Position) => {
    setEditingPositionId(position.position_id)
    setEditPositionFormData({
      name: position.name,
      level: position.level,
      description: position.description || "",
      is_active: position.is_active
    })
  }

  const handleSavePositionEdit = async () => {
    if (!editingPositionId) return

    try {
      setSavingPosition(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return

      const response = await fetch(`/api/positions/${editingPositionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: editPositionFormData.name,
          level: editPositionFormData.level,
          description: editPositionFormData.description || null,
          is_active: editPositionFormData.is_active
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update position')
      }

      setEditingPositionId(null)
      fetchPositions()
    } catch (error) {
      console.error('Error updating position:', error)
      alert(error instanceof Error ? error.message : 'Failed to update position')
    } finally {
      setSavingPosition(false)
    }
  }

  const handleDeletePosition = (position: Position) => {
    setPositionToDelete(position)
    setDeletePositionConfirmOpen(true)
  }

  const handleConfirmPositionDelete = async () => {
    if (!positionToDelete) return

    try {
      setDeletingPosition(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return

      const response = await fetch(`/api/positions/${positionToDelete.position_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete position')
      }

      setDeletePositionConfirmOpen(false)
      setPositionToDelete(null)
      fetchPositions()
    } catch (error) {
      console.error('Error deleting position:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete position')
    } finally {
      setDeletingPosition(false)
    }
  }

  // Commission management functions
  const handleCommissionChange = (positionId: string, productId: string, value: string) => {
    const key = `${positionId}-${productId}`
    const numValue = parseFloat(value)

    if (!isNaN(numValue) && numValue >= 0 && numValue <= 999.99) {
      setCommissionEdits(prev => ({ ...prev, [key]: numValue }))
    } else if (value === '') {
      const newEdits = { ...commissionEdits }
      delete newEdits[key]
      setCommissionEdits(newEdits)
    }
  }

  const handleSaveCommissions = async () => {
    if (Object.keys(commissionEdits).length === 0) {
      alert('No changes to save')
      return
    }

    try {
      setSavingCommissions(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) return

      const commissionsToSave = Object.entries(commissionEdits).map(([key, percentage]) => {
        const [position_id, product_id] = key.split('-')
        return { position_id, product_id, commission_percentage: percentage }
      })

      const response = await fetch('/api/positions/product-commissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ commissions: commissionsToSave })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save commissions')
      }

      setCommissionEdits({})
      fetchCommissions(selectedCommissionCarrier || undefined)
      alert('Commissions saved successfully!')
    } catch (error) {
      console.error('Error saving commissions:', error)
      alert(error instanceof Error ? error.message : 'Failed to save commissions')
    } finally {
      setSavingCommissions(false)
    }
  }

  // Product management functions (keeping existing code)
  const handleProductCreated = async (newProduct: Product) => {
    setAllProducts(prev => [...prev, newProduct])

    if (newProduct.carrier_id === selectedCarrier) {
      setProducts(prev => [...prev, newProduct])
    }

    const existingCarrier = carriers.find(carrier => carrier.id === newProduct.carrier_id)
    if (!existingCarrier) {
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
    setOriginalProductData(formData)
  }

  const handleCancelProductEdit = () => {
    setEditingProductId(null)
    setEditProductFormData({ name: "", product_code: "", is_active: true })
    setOriginalProductData(null)
  }

  const handleSaveProductEdit = async () => {
    if (!editingProductId || !originalProductData) return

    const hasChanges = (
      editProductFormData.name !== originalProductData.name ||
      editProductFormData.product_code !== originalProductData.product_code ||
      editProductFormData.is_active !== originalProductData.is_active
    )

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

      setAllProducts(prev => prev.filter(product => product.id !== productToDelete.id))
      setProducts(prev => prev.filter(product => product.id !== productToDelete.id))

      const remainingProductsForCarrier = allProducts.filter(
        product => product.id !== productToDelete.id && product.carrier_id === productToDelete.carrier_id
      )

      if (remainingProductsForCarrier.length === 0) {
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

              if (selectedCarrier === productToDelete.carrier_id) {
                setSelectedCarrier("")
              }
            }
          }
        } catch (error) {
          console.error('Error refreshing carriers:', error)
        }
      }

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
    const uploadedFiles = uploads.filter(u => u.file !== null) as Array<{ carrier: string; file: File }>;
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one policy report before analyzing.')
      return
    }

    try {
      setUploadingReports(true)

      // 0) Create an ingest job first
      const expectedFiles = uploadedFiles.length
      const clientJobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // Resolve agencyId from current session
      let agencyId: string | null = null
      try {
        const supabase = createClient()
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth?.user?.id
        if (userId) {
          const { data: userRow, error: userError } = await supabase
            .from('users')
            .select('agency_id')
            .eq('auth_user_id', userId)
            .single()
          if (!userError) {
            agencyId = userRow?.agency_id ?? null
          }
        }
      } catch {}

      if (!agencyId) {
        alert('Could not resolve your agency. Please refresh and try again.')
        return
      }

      const jobResp = await fetch('/api/upload-policy-reports/create-job', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          expectedFiles,
          clientJobId,
        }),
      })
      const jobJson = await jobResp.json().catch(() => null)
      if (!jobResp.ok || !jobJson?.job?.jobId) {
        console.error('Failed to create ingest job', { status: jobResp.status, body: jobJson })
        alert('Could not start ingest job. Please try again.')
        return
      }
      const jobId = jobJson.job.jobId as string
      console.debug('Created ingest job', { jobId, expectedFiles })

      // 1) Request presigned URLs for all files in a single call (new ingestion flow)
      const signResp = await fetch('/api/upload-policy-reports/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId,
          files: uploadedFiles.map(({ file }) => ({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          })),
        }),
      })
      const signJson = await signResp.json().catch(() => null)
      if (!signResp.ok || !Array.isArray(signJson?.files)) {
        console.error('Presign failed', { status: signResp.status, body: signJson })
        alert('Could not generate upload URLs. Please try again.')
        return
      }

      // 2) Upload each file via its presigned URL (no chunking; URLs expire in 60s)
      const results = await Promise.allSettled(
        (signJson.files as Array<{ fileId: string; fileName: string; presignedUrl: string }>).
          map(async (f) => {
            const match = uploadedFiles.find(uf => uf.file.name === f.fileName)
            if (!match) throw new Error(`Missing file for ${f.fileName}`)
            const res = await putToSignedUrl(f.presignedUrl, match.file)
            if (!res.ok) throw new Error(`Upload failed with status ${res.status}`)
            return { fileName: f.fileName, fileId: f.fileId }
          })
      )

      // 3) Summarize uploads
      const successes: { carrier: string; file: string; paths: string[] }[] = [];
      const failures: string[] = [];

      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          successes.push({ carrier: 'n/a', file: r.value.fileName, paths: [] });
        } else {
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          failures.push(reason)
        }
      })

      if (successes.length) console.log('Uploaded:', successes);
      if (failures.length) console.error('Failed uploads:', failures);

      if (failures.length === 0) {
        alert(`Successfully uploaded ${successes.length} file(s).`)
        setUploads(uploads.map(u => ({ carrier: u.carrier, file: null })))
        checkExistingPolicyFiles()
      } else {
        alert(`Uploaded ${successes.length} file(s), but ${failures.length} failed: ${failures.join(', ')}`)
      }
    } catch (err) {
      console.error('Unexpected error during upload:', err);
      alert('An unexpected error occurred while uploading. Please try again.')
    } finally {
      setUploadingReports(false)
    }
  }

  // Tab configuration with icons
  const tabs = [
    { id: "carriers" as TabType, label: "Carriers & Products", icon: Package },
    { id: "positions" as TabType, label: "Positions", icon: Users },
    { id: "commissions" as TabType, label: "Commissions", icon: DollarSign },
    { id: "lead-sources" as TabType, label: "Lead Sources", icon: Users },
    { id: "messaging" as TabType, label: "Messaging", icon: MessageSquare },
    { id: "policy-reports" as TabType, label: "Policy Reports", icon: BarChart3 },
    { id: "discord" as TabType, label: "Discord Notifications", icon: Bell },
  ]

  // Get commissions grid data
  const getCommissionsGrid = () => {
    if (!selectedCommissionCarrier || commissions.length === 0) return null

    // Filter commissions for selected carrier
    const carrierCommissions = commissions.filter(c => c.carrier_id === selectedCommissionCarrier)

    if (carrierCommissions.length === 0) return null

    // Get unique positions and products
    const uniquePositions = Array.from(new Set(carrierCommissions.map(c => c.position_id)))
      .map(posId => {
        const comm = carrierCommissions.find(c => c.position_id === posId)!
        return { id: posId, name: comm.position_name, level: comm.position_level }
      })
      .sort((a, b) => b.level - a.level) // Sort by level descending

    const uniqueProducts = Array.from(new Set(carrierCommissions.map(c => c.product_id)))
      .map(prodId => {
        const comm = carrierCommissions.find(c => c.product_id === prodId)!
        return { id: prodId, name: comm.product_name }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return { positions: uniquePositions, products: uniqueProducts, commissions: carrierCommissions }
  }

  const gridData = getCommissionsGrid()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your agency configuration</p>
        </div>

        {/* Main Content with Vertical Tabs */}
        <div className="flex gap-6">
          {/* Vertical Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-card rounded-lg shadow-sm border border-border p-2 space-y-1 sticky top-6">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                      activeTab === tab.id
                        ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1">
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              {/* Carriers Tab - KEEPING EXISTING CONTENT */}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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

              {/* POSITIONS TAB - NEW */}
              {activeTab === "positions" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Positions Management</h2>
                    <p className="text-sm text-muted-foreground">Manage position levels for your agency</p>
                  </div>

                  {/* Add New Position */}
                  <div className="mb-6 bg-accent/30 rounded-lg p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Add New Position</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        type="text"
                        value={newPosition.name}
                        onChange={(e) => setNewPosition(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Position name (e.g., EFO, MD)"
                        className="h-12"
                        disabled={savingPosition}
                      />
                      <Input
                        type="number"
                        value={newPosition.level || ''}
                        onChange={(e) => setNewPosition(prev => ({ ...prev, level: parseInt(e.target.value) || 0 }))}
                        placeholder="Level (higher = more senior)"
                        className="h-12"
                        disabled={savingPosition}
                      />
                      <Input
                        type="text"
                        value={newPosition.description}
                        onChange={(e) => setNewPosition(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Description (optional)"
                        className="h-12"
                        disabled={savingPosition}
                      />
                    </div>
                    <Button
                      onClick={handleAddPosition}
                      disabled={!newPosition.name.trim() || newPosition.level === 0 || savingPosition}
                      className="mt-4 h-12 px-6 bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Position
                    </Button>
                  </div>

                  {/* Positions List */}
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr className="border-b-2 border-border">
                          <th className="text-left py-4 px-6 font-bold text-gray-800">Position Name</th>
                          <th className="text-left py-4 px-6 font-bold text-gray-800">Level</th>
                          <th className="text-left py-4 px-6 font-bold text-gray-800">Description</th>
                          <th className="text-left py-4 px-6 font-bold text-gray-800">Status</th>
                          <th className="text-right py-4 px-6 font-bold text-gray-800">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positionsLoading ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                              Loading positions...
                            </td>
                          </tr>
                        ) : positions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground">
                              No positions found. Add one above to get started.
                            </td>
                          </tr>
                        ) : (
                          positions.map((position) => (
                            <tr key={position.position_id} className="border-b border-border hover:bg-blue-50 transition-colors">
                              <td className="py-5 px-6">
                                {editingPositionId === position.position_id ? (
                                  <Input
                                    type="text"
                                    value={editPositionFormData.name}
                                    onChange={(e) => setEditPositionFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="h-10"
                                  />
                                ) : (
                                  <span className="font-semibold text-foreground">{position.name}</span>
                                )}
                              </td>
                              <td className="py-5 px-6">
                                {editingPositionId === position.position_id ? (
                                  <Input
                                    type="number"
                                    value={editPositionFormData.level}
                                    onChange={(e) => setEditPositionFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 0 }))}
                                    className="h-10 w-24"
                                  />
                                ) : (
                                  <span className="text-foreground">{position.level}</span>
                                )}
                              </td>
                              <td className="py-5 px-6">
                                {editingPositionId === position.position_id ? (
                                  <Input
                                    type="text"
                                    value={editPositionFormData.description}
                                    onChange={(e) => setEditPositionFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="h-10"
                                    placeholder="Optional"
                                  />
                                ) : (
                                  <span className="text-muted-foreground">{position.description || 'N/A'}</span>
                                )}
                              </td>
                              <td className="py-5 px-6">
                                {editingPositionId === position.position_id ? (
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={editPositionFormData.is_active}
                                      onCheckedChange={(checked) => setEditPositionFormData(prev => ({ ...prev, is_active: checked as boolean }))}
                                    />
                                    <span className="text-sm">{editPositionFormData.is_active ? "Active" : "Inactive"}</span>
                                  </div>
                                ) : (
                                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    position.is_active
                                      ? "bg-green-100 text-green-800 border border-green-300"
                                      : "bg-red-100 text-red-800 border border-red-300"
                                  }`}>
                                    {position.is_active ? "Active" : "Inactive"}
                                  </span>
                                )}
                              </td>
                              <td className="py-5 px-6">
                                <div className="flex items-center justify-end space-x-2">
                                  {editingPositionId === position.position_id ? (
                                    <>
                                      <button
                                        onClick={handleSavePositionEdit}
                                        disabled={savingPosition}
                                        className="text-green-600 hover:text-green-800 p-2 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                      >
                                        <Check className="h-5 w-5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingPositionId(null)}
                                        disabled={savingPosition}
                                        className="text-muted-foreground hover:text-foreground p-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
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
              )}

              {/* COMMISSIONS TAB - NEW */}
              {activeTab === "commissions" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Commission Configuration</h2>
                    <p className="text-sm text-muted-foreground">Set commission percentages for each position-product combination</p>
                  </div>

                  {/* Carrier Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">Select Carrier</label>
                    <select
                      value={selectedCommissionCarrier}
                      onChange={(e) => {
                        setSelectedCommissionCarrier(e.target.value)
                        fetchCommissions(e.target.value || undefined)
                        setCommissionEdits({})
                      }}
                      className="w-full md:w-96 h-12 px-4 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select a carrier --</option>
                      {carriers.map((carrier) => (
                        <option key={carrier.id} value={carrier.id}>
                          {carrier.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Commissions Grid */}
                  {commissionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : !selectedCommissionCarrier ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a carrier to view and edit commission percentages</p>
                    </div>
                  ) : !gridData ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No commission data found for this carrier.</p>
                      <p className="text-sm mt-2">Make sure you have positions and products configured.</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-lg border border-border mb-4">
                        <table className="w-full">
                          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <tr className="border-b-2 border-border">
                              <th className="text-left py-4 px-6 font-bold text-gray-800 sticky left-0 bg-gray-50 z-10">Position</th>
                              {gridData.products.map((product) => (
                                <th key={product.id} className="text-center py-4 px-4 font-bold text-gray-800 min-w-[150px]">
                                  {product.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {gridData.positions.map((position) => (
                              <tr key={position.id} className="border-b border-border hover:bg-blue-50 transition-colors">
                                <td className="py-4 px-6 font-semibold text-foreground sticky left-0 bg-white z-10">
                                  {position.name}
                                  <span className="ml-2 text-xs text-muted-foreground">(Level {position.level})</span>
                                </td>
                                {gridData.products.map((product) => {
                                  const commission = gridData.commissions.find(
                                    c => c.position_id === position.id && c.product_id === product.id
                                  )
                                  const key = `${position.id}-${product.id}`
                                  const editedValue = commissionEdits[key]
                                  const currentValue = editedValue !== undefined ? editedValue : commission?.commission_percentage

                                  return (
                                    <td key={product.id} className="py-4 px-4 text-center">
                                      <div className="relative inline-block">
                                        <Input
                                          type="number"
                                          value={currentValue !== undefined ? currentValue : ''}
                                          onChange={(e) => handleCommissionChange(position.id, product.id, e.target.value)}
                                          placeholder="0.00"
                                          step="0.01"
                                          min="0"
                                          max="999.99"
                                          className={cn(
                                            "h-10 w-28 text-center",
                                            editedValue !== undefined && "border-blue-500 bg-blue-50"
                                          )}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">%</span>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {Object.keys(commissionEdits).length > 0 && (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="text-blue-800">
                            <p className="font-semibold">{Object.keys(commissionEdits).length} unsaved changes</p>
                            <p className="text-sm">Click Save to apply your commission changes</p>
                          </div>
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setCommissionEdits({})}
                              disabled={savingCommissions}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleSaveCommissions}
                              disabled={savingCommissions}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {savingCommissions ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Save Changes
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* KEEPING ALL EXISTING TABS: Lead Sources, Messaging, Policy Reports, Discord */}
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

              {/* Messaging Tab (Combined SMS Settings + Messaging) - KEEPING EXISTING CODE */}
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

              {/* Policy Reports Tab - KEEPING EXISTING CODE */}
              {activeTab === "policy-reports" && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Policy Reports</h2>
                    <p className="text-sm text-muted-foreground">Upload CSV or Excel files for each carrier to analyze persistency rates</p>
                  </div>

                  {checkingExistingFiles && uploadedFilesInfo.length === 0 && (
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

              {/* Discord Tab - KEEPING EXISTING CODE */}
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
        </div>

        {/* Products Modal - KEEPING EXISTING */}
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

        {/* Product Delete Confirmation Modal - KEEPING EXISTING */}
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

        {/* Position Delete Confirmation Modal - NEW */}
        <Dialog open={deletePositionConfirmOpen} onOpenChange={setDeletePositionConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Position</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-muted-foreground">
                Are you sure you want to delete the position "{positionToDelete?.name}"? This action cannot be undone.
              </p>
              <p className="text-sm text-amber-700 mt-2">
                Note: You cannot delete a position that is currently assigned to agents.
              </p>
            </div>
            <DialogFooter className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setDeletePositionConfirmOpen(false)}
                disabled={deletingPosition}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmPositionDelete}
                disabled={deletingPosition}
              >
                {deletingPosition ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
