"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Plus, Check, X, Upload, FileText, TrendingUp, Loader2, Package, DollarSign, Users, MessageSquare, BarChart3, Bell, Building2, Palette, Image, Moon, Sun, Monitor } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import AddProductModal from "@/components/modals/add-product-modal"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { putToSignedUrl } from '@/lib/upload-policy-reports/client'
import { HexColorPicker } from 'react-colorful'
import { useTheme } from "next-themes"

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
  display_name?: string
  logo_url?: string
  primary_color?: string
  theme_mode?: 'light' | 'dark' | 'system'
  whitelabel_domain?: string
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

type TabType = "agency-profile" | "carriers" | "positions" | "commissions" | "lead-sources" | "messaging" | "policy-reports" | "discord"

export default function ConfigurationPage() {
  const { theme, setTheme } = useTheme()
  const [selectedCarrier, setSelectedCarrier] = useState<string>("")
  const [productsModalOpen, setProductsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("agency-profile")

  // Agency Profile state
  const [agency, setAgency] = useState<Agency | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [displayNameValue, setDisplayNameValue] = useState("")
  const [savingDisplayName, setSavingDisplayName] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [primaryColor, setPrimaryColor] = useState("217 91% 60%") // Default blue
  const [editingColor, setEditingColor] = useState(false)
  const [colorValue, setColorValue] = useState("")
  const [savingColor, setSavingColor] = useState(false)
  const [agencyThemeMode, setAgencyThemeMode] = useState<'light' | 'dark' | 'system'>('system')
  const [savingTheme, setSavingTheme] = useState(false)
  const [loadingAgencyProfile, setLoadingAgencyProfile] = useState(true)

  // White-label Domain state
  const [whitelabelDomain, setWhitelabelDomain] = useState("")
  const [editingWhitelabelDomain, setEditingWhitelabelDomain] = useState(false)
  const [whitelabelDomainValue, setWhitelabelDomainValue] = useState("")
  const [savingWhitelabelDomain, setSavingWhitelabelDomain] = useState(false)

  // Lead Sources state
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
    { carrier: 'Transamerica', file: null },
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
  const [syncingMissingCommissions, setSyncingMissingCommissions] = useState(false)

  // Load data on mount
  useEffect(() => {
    fetchAllData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check for existing policy files when policy reports tab is opened (only if we haven't checked yet)
  useEffect(() => {
    if (activeTab === 'policy-reports' && uploadedFilesInfo.length === 0 && !checkingExistingFiles) {
      checkExistingPolicyFiles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Load positions when positions tab is opened
  useEffect(() => {
    if (activeTab === 'positions') {
      fetchPositions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Load commissions when commissions tab is opened
  useEffect(() => {
    if (activeTab === 'commissions' && !commissionsLoading) {
      fetchCommissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            .select('id, name, display_name, logo_url, primary_color, theme_mode, lead_sources, phone_number, messaging_enabled, discord_webhook_url, whitelabel_domain')
            .eq('id', userData.agency_id)
            .single()

          if (agencyInfo) {
            agencyData = agencyInfo
            setAgency(agencyInfo)
            setDisplayName(agencyInfo.display_name || agencyInfo.name)
            setPrimaryColor(agencyInfo.primary_color || "217 91% 60%")
            const themeMode = (agencyInfo.theme_mode || 'system') as 'light' | 'dark' | 'system'
            setAgencyThemeMode(themeMode)
            setTheme(themeMode) // Apply the theme immediately
            setLeadSources(agencyInfo.lead_sources || [])
            setAgencyPhoneNumber(agencyInfo.phone_number || "")
            setMessagingEnabled(agencyInfo.messaging_enabled || false)
            setDiscordWebhookUrl(agencyInfo.discord_webhook_url || "")
            setWhitelabelDomain(agencyInfo.whitelabel_domain || "")
            setLoadingAgencyProfile(false)
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

  // Agency Profile Management Functions
  const handleEditDisplayName = () => {
    setEditingDisplayName(true)
    setDisplayNameValue(displayName)
  }

  const handleSaveDisplayName = async () => {
    if (!agency) return

    try {
      setSavingDisplayName(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ display_name: displayNameValue.trim() })
        .eq('id', agency.id)

      if (error) throw error

      setDisplayName(displayNameValue.trim())
      setEditingDisplayName(false)
      setDisplayNameValue("")
    } catch (error) {
      console.error('Error updating display name:', error)
      alert('Failed to update display name')
    } finally {
      setSavingDisplayName(false)
    }
  }

  const handleCancelDisplayNameEdit = () => {
    setEditingDisplayName(false)
    setDisplayNameValue("")
  }

  const handleLogoUpload = async (file: File) => {
    if (!agency) {
      alert('Agency information not loaded. Please refresh the page.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      alert('File size must be less than 5MB')
      return
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (PNG, JPG, SVG, or WebP)')
      return
    }

    try {
      setUploadingLogo(true)
      const supabase = createClient()

      console.log('Starting logo upload...', {
        agencyId: agency.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })

      // Upload to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${agency.id}/logo.${fileExt}`

      console.log('Uploading to storage path:', fileName)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        })

      if (uploadError) {
        console.error('Storage upload error:', {
          error: uploadError,
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          details: uploadError
        })
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      console.log('Upload successful:', uploadData)

      // Get public URL with cache-busting timestamp
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      // Add timestamp query parameter to bust browser and CDN cache
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

      console.log('Public URL generated:', cacheBustedUrl)

      // Update agency with logo URL (including cache-busting parameter)
      const { error: updateError } = await supabase
        .from('agencies')
        .update({ logo_url: cacheBustedUrl })
        .eq('id', agency.id)

      if (updateError) {
        console.error('Database update error:', updateError)
        throw new Error(`Failed to update database: ${updateError.message}`)
      }

      console.log('Logo URL saved to database successfully')
      console.log('Public URL:', cacheBustedUrl)

      // Update local state with cache-busted URL
      setAgency({ ...agency, logo_url: cacheBustedUrl })

      // Extract dominant color from the uploaded image (use original URL without cache param)
      await extractDominantColor(publicUrl)

      alert('Logo uploaded successfully! Please refresh the page to see it in the navigation.')
    } catch (error) {
      console.error('Error uploading logo:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to upload logo: ${errorMessage}. Check console for details.`)
    } finally {
      setUploadingLogo(false)
    }
  }

  // Extract dominant color from logo
  const extractDominantColor = async (imageUrl: string) => {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageUrl

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      let r = 0, g = 0, b = 0, count = 0

      // Sample pixels and calculate average
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]
        if (alpha > 128) { // Only count non-transparent pixels
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
      }

      if (count > 0) {
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)

        const hsl = rgbToHSL(r, g, b)
        const suggestedColor = `${hsl.h} ${hsl.s}% ${hsl.l}%`

        // Ask user if they want to use the suggested color
        const useSuggested = window.confirm(
          `We detected a color from your logo. Would you like to use it as your primary color?`
        )

        if (useSuggested && agency) {
          const supabase = createClient()
          const { error } = await supabase
            .from('agencies')
            .update({ primary_color: suggestedColor })
            .eq('id', agency.id)

          if (!error) {
            setPrimaryColor(suggestedColor)
            setColorValue(suggestedColor)
            document.documentElement.style.setProperty('--primary', suggestedColor)
          }
        }
      }
    } catch (error) {
      console.error('Error extracting color:', error)
      // Silently fail - color extraction is optional
    }
  }

  // Convert RGB to HSL
  const rgbToHSL = (r: number, g: number, b: number) => {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    }
  }

  const handleRemoveLogo = async () => {
    if (!agency || !agency.logo_url) return

    const confirmed = window.confirm('Are you sure you want to remove the agency logo?')
    if (!confirmed) return

    try {
      setUploadingLogo(true)
      const supabase = createClient()

      // Update agency to remove logo URL
      const { error } = await supabase
        .from('agencies')
        .update({ logo_url: null })
        .eq('id', agency.id)

      if (error) throw error

      setAgency({ ...agency, logo_url: undefined })
    } catch (error) {
      console.error('Error removing logo:', error)
      alert('Failed to remove logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleEditColor = () => {
    setEditingColor(true)
    setColorValue(primaryColor)
  }

  const handleSaveColor = async () => {
    if (!agency) return

    try {
      setSavingColor(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ primary_color: colorValue.trim() })
        .eq('id', agency.id)

      if (error) throw error

      setPrimaryColor(colorValue.trim())
      setEditingColor(false)
      setColorValue("")

      // Update CSS variable
      document.documentElement.style.setProperty('--primary', colorValue.trim())
    } catch (error) {
      console.error('Error updating color:', error)
      alert('Failed to update color')
    } finally {
      setSavingColor(false)
    }
  }

  const handleCancelColorEdit = () => {
    setEditingColor(false)
    setColorValue("")
  }

  // Theme Management Functions
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    if (!agency) return

    try {
      setSavingTheme(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ theme_mode: newTheme })
        .eq('id', agency.id)

      if (error) throw error

      setAgencyThemeMode(newTheme)
      setTheme(newTheme) // Apply the theme immediately
      setAgency({ ...agency, theme_mode: newTheme })
    } catch (error) {
      console.error('Error updating theme:', error)
      alert('Failed to update theme preference')
    } finally {
      setSavingTheme(false)
    }
  }

  // White-label Domain Management Functions
  const handleEditWhitelabelDomain = () => {
    setWhitelabelDomainValue(whitelabelDomain)
    setEditingWhitelabelDomain(true)
  }

  const handleCancelWhitelabelDomainEdit = () => {
    setEditingWhitelabelDomain(false)
    setWhitelabelDomainValue("")
  }

  const handleSaveWhitelabelDomain = async () => {
    if (!agency) return

    try {
      setSavingWhitelabelDomain(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('agencies')
        .update({ whitelabel_domain: whitelabelDomainValue.trim() || null })
        .eq('id', agency.id)

      if (error) throw error

      setWhitelabelDomain(whitelabelDomainValue.trim())
      setAgency({ ...agency, whitelabel_domain: whitelabelDomainValue.trim() || undefined })
      setEditingWhitelabelDomain(false)
    } catch (error) {
      console.error('Error updating whitelabel domain:', error)
      alert('Failed to update whitelabel domain')
    } finally {
      setSavingWhitelabelDomain(false)
    }
  }

  // Helper function to convert hex to HSL
  const hexToHSL = (hex: string): string => {
    // Remove # if present
    hex = hex.replace('#', '')

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    h = Math.round(h * 360)
    s = Math.round(s * 100)
    l = Math.round(l * 100)

    return `${h} ${s}% ${l}%`
  }

  // Helper function to convert HSL to hex
  const hslToHex = (hslString: string): string => {
    const match = hslString.match(/(\d+)\s+(\d+)%\s+(\d+)%/)
    if (!match) return '#000000'

    const h = parseInt(match[1]) / 360
    const s = parseInt(match[2]) / 100
    const l = parseInt(match[3]) / 100

    let r, g, b

    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
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

  const handleSyncMissingCommissions = async () => {
    if (!selectedCommissionCarrier) {
      alert('Please select a carrier first')
      return
    }

    try {
      setSyncingMissingCommissions(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch(`/api/positions/product-commissions/sync?carrier_id=${selectedCommissionCarrier}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync commissions')
      }

      if (data.created === 0) {
        alert('All products for this carrier already have commission entries!')
      } else {
        alert(`Successfully created ${data.created} missing commission entries for this carrier!`)
        // Refresh the commissions view
        fetchCommissions(selectedCommissionCarrier)
      }
    } catch (error) {
      console.error('Error syncing commissions:', error)
      alert(error instanceof Error ? error.message : 'Failed to sync commissions')
    } finally {
      setSyncingMissingCommissions(false)
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

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch(`/api/products/${editingProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
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
    { id: "agency-profile" as TabType, label: "Agency Profile", icon: Building2 },
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

        {/* Horizontal Tabs Navigation */}
        <div className="mb-6">
          <div className="bg-card rounded-lg shadow-sm border border-border">
            <div className="overflow-x-auto">
              <div className="flex min-w-max border-b border-border">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap border-b-2",
                        activeTab === tab.id
                          ? "border-blue-600 text-blue-700 bg-blue-50/50"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              {/* Agency Profile Tab - NEW */}
              {activeTab === "agency-profile" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Agency Profile</h2>
                    <p className="text-sm text-muted-foreground">Customize your agency branding and appearance</p>
                  </div>

                  {loadingAgencyProfile ? (
                    /* Loading Skeleton */
                    <div className="space-y-6">
                      {/* Display Name Skeleton */}
                      <div className="bg-accent/30 rounded-lg p-6 border border-border">
                        <div className="h-7 w-48 bg-gray-200 rounded animate-pulse mb-4" />
                        <div className="h-4 w-full max-w-2xl bg-gray-200 rounded animate-pulse mb-4" />
                        <div className="h-12 w-full bg-gray-200 rounded animate-pulse" />
                      </div>

                      {/* Logo Skeleton */}
                      <div className="bg-accent/30 rounded-lg p-6 border border-border">
                        <div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-4" />
                        <div className="h-4 w-full max-w-2xl bg-gray-200 rounded animate-pulse mb-4" />
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="w-full md:w-48 h-48 bg-gray-200 rounded-lg animate-pulse" />
                          <div className="flex-1 space-y-3">
                            <div className="h-12 w-full bg-gray-200 rounded animate-pulse" />
                            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                          </div>
                        </div>
                      </div>

                      {/* Color Picker Skeleton */}
                      <div className="bg-accent/30 rounded-lg p-6 border border-border">
                        <div className="h-7 w-56 bg-gray-200 rounded animate-pulse mb-4" />
                        <div className="h-4 w-full max-w-2xl bg-gray-200 rounded animate-pulse mb-6" />
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="w-56 h-56 bg-gray-200 rounded-lg animate-pulse" />
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                                <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
                                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Agency Display Name */}
                      <div className="bg-accent/30 rounded-lg p-6 border border-border">
                        <h3 className="text-xl font-semibold text-foreground mb-4">Agency Display Name</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          This name will be displayed in the navigation sidebar and throughout the platform.
                        </p>

                        {editingDisplayName ? (
                        <div className="flex gap-3">
                          <Input
                            type="text"
                            value={displayNameValue}
                            onChange={(e) => setDisplayNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveDisplayName()
                              if (e.key === 'Escape') handleCancelDisplayNameEdit()
                            }}
                            placeholder="Enter agency display name"
                            className="flex-1 h-12 text-lg"
                            disabled={savingDisplayName}
                          />
                          <button
                            onClick={handleSaveDisplayName}
                            disabled={savingDisplayName || !displayNameValue.trim()}
                            className="text-green-600 hover:text-green-800 p-3 disabled:opacity-50 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <Check className="h-6 w-6" />
                          </button>
                          <button
                            onClick={handleCancelDisplayNameEdit}
                            disabled={savingDisplayName}
                            className="text-muted-foreground hover:text-foreground p-3 disabled:opacity-50 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                          >
                            <X className="h-6 w-6" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-card rounded-lg border-2 border-border p-4">
                            <p className="text-xl font-semibold text-card-foreground">
                              {displayName || <span className="text-muted-foreground italic">Not set</span>}
                            </p>
                          </div>
                          <button
                            onClick={handleEditDisplayName}
                            className="p-3 rounded-lg transition-colors"
                            style={{
                              backgroundColor: `hsl(${primaryColor} / 0.1)`,
                              color: `hsl(${primaryColor})`
                            }}
                          >
                            <Edit className="h-6 w-6" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Agency Logo */}
                    <div className="bg-accent/30 rounded-lg p-6 border border-border">
                      <h3 className="text-xl font-semibold text-foreground mb-4">Agency Logo</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload your agency logo. This will replace the default icon in the navigation sidebar. Recommended size: 200x200px or larger, square format.
                      </p>

                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Logo Preview */}
                        <div className="flex items-center justify-center w-full md:w-48 h-48 bg-card rounded-lg border-2 border-border">
                          {agency?.logo_url ? (
                            <img
                              src={agency.logo_url}
                              alt="Agency Logo"
                              className="max-w-full max-h-full object-contain p-2"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                console.error('Error loading logo:', agency.logo_url)
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <Image className="h-16 w-16 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No logo uploaded</p>
                            </div>
                          )}
                        </div>

                        {/* Upload Controls */}
                        <div className="flex-1 flex flex-col justify-center gap-3">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleLogoUpload(file)
                            }}
                            className="hidden"
                            id="logo-upload"
                            disabled={uploadingLogo}
                          />
                          <label
                            htmlFor="logo-upload"
                            className={cn(
                              "cursor-pointer text-white px-6 py-3 rounded-lg transition-colors text-center font-medium",
                              uploadingLogo && "opacity-50 cursor-not-allowed"
                            )}
                            style={{
                              backgroundColor: `hsl(${primaryColor})`,
                            }}
                          >
                            {uploadingLogo ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-5 w-5 inline mr-2" />
                                {agency?.logo_url ? 'Replace Logo' : 'Upload Logo'}
                              </>
                            )}
                          </label>
                          {agency?.logo_url && (
                            <Button
                              onClick={handleRemoveLogo}
                              disabled={uploadingLogo}
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-5 w-5 mr-2" />
                              Remove Logo
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Supported formats: PNG, JPG, SVG, WebP
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Primary Color Scheme */}
                    <div className="bg-accent/30 rounded-lg p-6 border border-border">
                      <h3 className="text-xl font-semibold text-foreground mb-4">
                        <Palette className="h-5 w-5 inline mr-2" />
                        Primary Color Scheme
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Choose your agency's primary brand color. This color will be used for buttons, links, and highlights throughout the platform.
                      </p>

                      <div className="space-y-6">
                        {/* Color Picker */}
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Visual Color Picker */}
                          <div className="flex-shrink-0">
                            <HexColorPicker
                              color={hslToHex(editingColor ? colorValue : primaryColor)}
                              onChange={(hex) => {
                                const hsl = hexToHSL(hex)
                                if (editingColor) {
                                  setColorValue(hsl)
                                } else {
                                  setColorValue(hsl)
                                  setEditingColor(true)
                                }
                              }}
                              style={{ width: '220px', height: '220px' }}
                            />
                          </div>

                          {/* Color Info and Controls */}
                          <div className="flex-1 space-y-4">
                            {/* Current/Selected Color Display */}
                            <div className="flex items-center gap-4">
                              <div
                                className="w-20 h-20 rounded-lg border-2 border-gray-200 shadow-sm"
                                style={{ backgroundColor: `hsl(${editingColor ? colorValue : primaryColor})` }}
                              />
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground mb-1">
                                  {editingColor ? 'Selected Color' : 'Current Color'}
                                </p>
                                <p className="text-lg font-mono text-foreground">
                                  {editingColor ? colorValue : primaryColor}
                                </p>
                                <p className="text-sm font-mono text-muted-foreground">
                                  {hslToHex(editingColor ? colorValue : primaryColor)}
                                </p>
                              </div>
                            </div>

                            {/* Manual Input */}
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                Or enter manually (HSL format):
                              </label>
                              <Input
                                type="text"
                                value={editingColor ? colorValue : primaryColor}
                                onChange={(e) => {
                                  setColorValue(e.target.value)
                                  setEditingColor(true)
                                }}
                                placeholder="e.g., 217 91% 60%"
                                className="h-10 font-mono"
                                disabled={savingColor}
                              />
                            </div>

                            {/* Action Buttons */}
                            {editingColor && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={handleSaveColor}
                                  disabled={savingColor || !colorValue.trim()}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {savingColor ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Save Color
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={handleCancelColorEdit}
                                  disabled={savingColor}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Info about color extraction */}

                      </div>
                    </div>

                    {/* Theme Preference */}
                    <div className="bg-accent/30 rounded-lg p-6 border border-border">
                      <h3 className="text-xl font-semibold text-foreground mb-4">
                        <Moon className="h-5 w-5 inline mr-2" />
                        Theme Preference
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Choose the theme mode for your agency. This will be applied automatically for all users in your agency.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Light Theme Option */}
                        <button
                          onClick={() => handleThemeChange('light')}
                          disabled={savingTheme}
                          className={cn(
                            "relative p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                            agencyThemeMode === 'light'
                              ? "border-blue-500 bg-blue-50 shadow-lg"
                              : "border-border bg-card hover:border-blue-300"
                          )}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Sun className={cn(
                              "h-10 w-10",
                              agencyThemeMode === 'light' ? "text-blue-600" : "text-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold text-lg",
                                agencyThemeMode === 'light' ? "text-blue-600" : "text-foreground"
                              )}>
                                Light
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Bright, clean interface
                              </p>
                            </div>
                            {agencyThemeMode === 'light' && (
                              <div className="absolute top-3 right-3">
                                <Check className="h-5 w-5 text-blue-600" />
                              </div>
                            )}
                          </div>
                        </button>

                        {/* Dark Theme Option */}
                        <button
                          onClick={() => handleThemeChange('dark')}
                          disabled={savingTheme}
                          className={cn(
                            "relative p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                            agencyThemeMode === 'dark'
                              ? "border-blue-500 bg-blue-50 shadow-lg"
                              : "border-border bg-card hover:border-blue-300"
                          )}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Moon className={cn(
                              "h-10 w-10",
                              agencyThemeMode === 'dark' ? "text-blue-600" : "text-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold text-lg",
                                agencyThemeMode === 'dark' ? "text-blue-600" : "text-foreground"
                              )}>
                                Dark
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Easy on the eyes
                              </p>
                            </div>
                            {agencyThemeMode === 'dark' && (
                              <div className="absolute top-3 right-3">
                                <Check className="h-5 w-5 text-blue-600" />
                              </div>
                            )}
                          </div>
                        </button>

                        {/* System Theme Option */}
                        <button
                          onClick={() => handleThemeChange('system')}
                          disabled={savingTheme}
                          className={cn(
                            "relative p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                            agencyThemeMode === 'system'
                              ? "border-blue-500 bg-blue-50 shadow-lg"
                              : "border-border bg-card hover:border-blue-300"
                          )}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Monitor className={cn(
                              "h-10 w-10",
                              agencyThemeMode === 'system' ? "text-blue-600" : "text-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold text-lg",
                                agencyThemeMode === 'system' ? "text-blue-600" : "text-foreground"
                              )}>
                                System
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Follow device settings
                              </p>
                            </div>
                            {agencyThemeMode === 'system' && (
                              <div className="absolute top-3 right-3">
                                <Check className="h-5 w-5 text-blue-600" />
                              </div>
                            )}
                          </div>
                        </button>
                      </div>

                      {savingTheme && (
                        <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving theme preference...
                        </div>
                      )}
                    </div>

                    {/* White-label Domain */}
                    <div className="bg-accent/30 rounded-lg p-6 border border-border">
                      <h3 className="text-xl font-semibold text-foreground mb-4">White-label Domain</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Configure a custom domain for your agency to white-label the application. Users will see your branding when accessing the app from this domain.
                      </p>

                      {editingWhitelabelDomain ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Custom Domain (e.g., agents.youragency.com)
                            </label>
                            <Input
                              type="text"
                              value={whitelabelDomainValue}
                              onChange={(e) => setWhitelabelDomainValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveWhitelabelDomain()
                                if (e.key === 'Escape') handleCancelWhitelabelDomainEdit()
                              }}
                              placeholder="agents.youragency.com"
                              className="h-12"
                              disabled={savingWhitelabelDomain}
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              After adding your domain, you'll need to configure a CNAME record with your DNS provider pointing to <code className="bg-muted px-1 py-0.5 rounded">cname.vercel-dns.com</code>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSaveWhitelabelDomain}
                              disabled={savingWhitelabelDomain}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {savingWhitelabelDomain ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Save Domain
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleCancelWhitelabelDomainEdit}
                              disabled={savingWhitelabelDomain}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-card rounded-lg border-2 border-border p-4">
                            <p className="text-lg font-mono text-card-foreground">
                              {whitelabelDomain || <span className="text-muted-foreground italic">Not configured</span>}
                            </p>
                          </div>
                          <button
                            onClick={handleEditWhitelabelDomain}
                            className="p-3 rounded-lg transition-colors"
                            style={{
                              backgroundColor: `hsl(${primaryColor} / 0.1)`,
                              color: `hsl(${primaryColor})`
                            }}
                          >
                            <Edit className="h-6 w-6" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Preview Section */}
                    <div className="bg-accent/30 rounded-lg p-6 border border-border">
                      <h3 className="text-lg font-semibold text-foreground mb-3">
                        <span className="inline-flex items-center gap-2">
                          Preview
                          <span className="text-xs font-normal text-muted-foreground">(Shows how your branding appears)</span>
                        </span>
                      </h3>

                      <div className="space-y-6">
                        {/* Sidebar Logo Preview */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Navigation Sidebar:
                          </p>
                          <div className="bg-sidebar-background rounded-lg p-6 border-2 border-sidebar-border">
                            <div className="flex items-center space-x-3">
                              {agency?.logo_url ? (
                                <img
                                  src={agency.logo_url}
                                  alt="Logo Preview"
                                  className="w-10 h-10 rounded-xl object-contain"
                                  crossOrigin="anonymous"
                                />
                              ) : (
                                <div
                                  className="flex items-center justify-center w-10 h-10 rounded-xl text-white font-bold text-lg"
                                  style={{ backgroundColor: `hsl(${primaryColor})` }}
                                >
                                  <Building2 className="h-6 w-6" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-lg font-bold text-sidebar-foreground">{displayName || 'Your Agency'}</span>
                                <span className="text-xs text-muted-foreground" style={{ fontFamily: 'Times New Roman, serif' }}>
                                  Powered by AgentSpace
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Page Title and Buttons Preview */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Page Headers & Buttons:
                          </p>
                          <div className="bg-background rounded-lg p-6 border-2 border-border space-y-4">
                            {/* Title Example */}
                            <h1 className="text-3xl font-bold text-foreground">Agents</h1>

                            {/* Button Examples */}
                            <div className="flex flex-wrap gap-3">
                              <button
                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                style={{
                                  backgroundColor: `hsl(${primaryColor})`,
                                  color: 'white'
                                }}
                              >
                                Table
                              </button>
                              <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors">
                                Graph
                              </button>
                              <button className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors">
                                Pending Positions
                              </button>
                              <button
                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                style={{
                                  backgroundColor: `hsl(${primaryColor})`,
                                  color: 'white'
                                }}
                              >
                                + Add User
                              </button>
                            </div>

                            {/* Preview Card */}
                            <div className="mt-4 bg-card border border-border rounded-lg p-4">
                              <h3 className="font-semibold text-card-foreground mb-2">Preview Card</h3>
                              <p className="text-sm text-muted-foreground">This shows how content cards appear with your theme.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}

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
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex-1">
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
                      {selectedCommissionCarrier && (
                        <Button
                          onClick={handleSyncMissingCommissions}
                          disabled={syncingMissingCommissions}
                          className="bg-gray-900 hover:bg-gray-800 text-white h-12"
                        >
                          {syncingMissingCommissions ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              Not seeing all products? Click to sync
                            </>
                          )}
                        </Button>
                      )}
                    </div>
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
                      <div className="overflow-auto rounded-lg border border-border mb-4 max-h-[600px]">
                        <table className="w-full">
                          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-20">
                            <tr className="border-b-2 border-border">
                              <th className="text-left py-4 px-6 font-bold text-gray-800 sticky left-0 bg-gray-50 z-30">Position</th>
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
                                <td className="py-4 px-6 font-semibold text-foreground sticky left-0 bg-white hover:bg-blue-50 z-10">
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
                          <strong>Carrier:</strong> Aetna<br />
                          <strong>Product:</strong> Term Life Insurance<br />
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
  )
}
