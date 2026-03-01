"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Edit, Trash2, Plus, Check, X, Upload, FileText, TrendingUp, Loader2, Package, DollarSign, Users, MessageSquare, BarChart3, Bell, Building2, Palette, Image, Moon, Sun, Monitor, Lock, ArrowLeft, ArrowRight, Calendar, Mail, MessageCircle, User, LogOut, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import AddProductModal from "@/components/modals/add-product-modal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, getContrastTextColor } from "@/lib/utils"
import { putToSignedUrl } from '@/lib/upload-policy-reports/client'
import { HexColorPicker } from 'react-colorful'
import { useTheme } from "next-themes"
import { useNotification } from "@/contexts/notification-context"
import { useAuth } from "@/providers/AuthProvider"
import { updateUserTheme, ThemeMode } from "@/lib/theme"
import { SmsTemplateEditor } from "@/components/sms-template-editor"
import { SmsAutomationSettings } from "@/components/sms-automation-settings"
import type { AgentAutoSendInfo } from "@/components/agent-sms-automation-list"
import { DiscordTemplateEditor } from "@/components/discord-template-editor"
import { DEFAULT_SMS_TEMPLATES, SMS_TEMPLATE_PLACEHOLDERS } from "@/lib/sms-template-helpers"
import { DEFAULT_DISCORD_TEMPLATE, DISCORD_TEMPLATE_PLACEHOLDERS } from "@/lib/discord-template-helpers"
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/useApiFetch'
import { queryKeys } from '@/hooks/queryKeys'
import { apiClient } from '@/lib/api-client'
import { QueryErrorDisplay } from '@/components/ui/query-error-display'
import {
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
  useUpdateProduct,
  useDeleteProduct,
  useSaveProductCommissions,
  useSyncCommissions,
  useSaveCarrierLogin,
  useCreatePolicyReportJob,
  useSignPolicyReportFiles,
  useUpdateAgencySettings,
  useUploadAgencyLogo,
  useUpdateAgencyColor,
} from '@/hooks/mutations'
import { useAgencySettings, type AgencySettings } from '@/hooks/useAgencySettings'

// Types for carrier data
interface Carrier {
  id: string
  name: string
  displayName: string
  isActive: boolean
  createdAt?: string
}

// Types for product data
interface Product {
  id: string
  carrierId: string
  agencyId?: string
  name: string
  productCode?: string
  isActive: boolean
  createdAt?: string
}

// Use AgencySettings type from hook for agency data
type Agency = AgencySettings

// Types for position data
interface Position {
  positionId: string
  name: string
  level: number
  description?: string
  isActive: boolean
  createdAt?: string
}

// Types for commission data
interface Commission {
  commissionId: string
  positionId: string
  positionName: string
  positionLevel: number
  productId: string
  productName: string
  carrierId: string
  carrierName: string
  commissionPercentage: number
}

type TabType = "agency-profile" | "carriers" | "positions" | "commissions" | "lead-sources" | "messaging" | "automation" | "policy-reports" | "discord" | "carrier-logins" | "email-notifications" | "sms-templates" | "payout-settings" | "scoreboard"

// Default primary color schemes for light and dark mode
const DEFAULT_PRIMARY_COLOR_LIGHT = "0 0% 0%" // Black for light mode
const DEFAULT_PRIMARY_COLOR_DARK = "0 0% 100%" // White for dark mode

// Helper function to get default primary color for a theme mode
const getDefaultPrimaryColor = (mode: 'light' | 'dark' | 'system' | string | null): string => {
  if (mode === 'dark') return DEFAULT_PRIMARY_COLOR_DARK
  if (mode === 'light') return DEFAULT_PRIMARY_COLOR_LIGHT
  // For system mode, we'll need to check the resolved theme
  // Default to light mode default
  return DEFAULT_PRIMARY_COLOR_LIGHT
}

// Helper function to check if a color is the default for a given mode
const isDefaultColorForMode = (color: string, mode: 'light' | 'dark' | 'system' | string | null): boolean => {
  const defaultColor = getDefaultPrimaryColor(mode)
  return color === defaultColor
}

export default function ConfigurationPage() {
  const { showSuccess, showError, showWarning } = useNotification()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { user, refreshUser, signOut } = useAuth()
  const [isMounted, setIsMounted] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Ensure we're on the client before using queryClient
  useEffect(() => {
    setIsMounted(true)
  }, [])
  const [selectedCarrier, setSelectedCarrier] = useState<string>("")
  const [productsModalOpen, setProductsModalOpen] = useState(false)

  // Get tab from URL or default to "agency-profile"
  const tabFromUrl = (searchParams.get('tab') as TabType) || "agency-profile"
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl)

  // Sync activeTab with URL parameter
  useEffect(() => {
    const urlTab = (searchParams.get('tab') as TabType) || "agency-profile"
    if (urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
  }, [searchParams])

  // Function to change tab and update URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    router.push(`/configuration?tab=${tab}`, { scroll: false })
  }

  // Agency Profile state
  const [agency, setAgency] = useState<Agency | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [displayNameValue, setDisplayNameValue] = useState("")
  const [savingDisplayName, setSavingDisplayName] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [primaryColor, setPrimaryColor] = useState("217 91% 60%") // Default blue
  const [savingColor, setSavingColor] = useState(false)
  const [savingAllChanges, setSavingAllChanges] = useState(false)
  const [pendingColor, setPendingColor] = useState<string | null>(null)
  const [pendingLogo, setPendingLogo] = useState<string | null>(null)
  
  // Parse HSL string into components
  const parseHSL = (hslString: string) => {
    const match = hslString.match(/(\d+)\s+(\d+)%\s+(\d+)%/)
    if (!match) return { h: 217, s: 91, l: 60 }
    return {
      h: parseInt(match[1]),
      s: parseInt(match[2]),
      l: parseInt(match[3])
    }
  }
  
  // Get current HSL components
  const currentHSL = parseHSL(primaryColor)
  const [hue, setHue] = useState(currentHSL.h)
  const [saturation, setSaturation] = useState(currentHSL.s)
  const [lightness, setLightness] = useState(currentHSL.l)
  
  // Update HSL components when primaryColor changes
  useEffect(() => {
    const hsl = parseHSL(primaryColor)
    setHue(hsl.h)
    setSaturation(hsl.s)
    setLightness(hsl.l)
    setPendingColor(null) // Clear pending when primaryColor is updated from server
  }, [primaryColor])

  // Track previous resolved theme to detect mode switches
  const previousResolvedThemeRef = useRef<string | null>(null)

  // Handle automatic primary color switching when theme changes (from ThemeToggle)
  useEffect(() => {
    if (!agency || !resolvedTheme) return
    
    const previousResolvedTheme = previousResolvedThemeRef.current
    const currentResolvedTheme = resolvedTheme
    
    // Only proceed if theme actually changed from light to dark or dark to light
    if (previousResolvedTheme && previousResolvedTheme !== currentResolvedTheme && 
        (previousResolvedTheme === 'light' || previousResolvedTheme === 'dark') &&
        (currentResolvedTheme === 'light' || currentResolvedTheme === 'dark')) {
      
      // Check if current primary color is the default for the previous mode
      const currentColor = primaryColor
      const isCurrentColorDefault = isDefaultColorForMode(currentColor, previousResolvedTheme as 'light' | 'dark')
      
      // If current color was the default for the previous mode, switch to default for new mode
      if (isCurrentColorDefault) {
        const newDefaultColor = getDefaultPrimaryColor(currentResolvedTheme as 'light' | 'dark')

        // Update local state and CSS variable
        setPrimaryColor(newDefaultColor)
        setPendingColor(null)
        document.documentElement.style.setProperty('--primary', newDefaultColor)
        const textColor = getContrastTextColor(newDefaultColor)
        document.documentElement.style.setProperty('--primary-foreground', textColor === 'white' ? '0 0% 100%' : '0 0% 0%')

        // Update database using mutation
        updatePrimaryColorMutation.mutate({ agencyId: agency.id, color: newDefaultColor })
      }
    }
    
    // Update the ref for next comparison
    previousResolvedThemeRef.current = currentResolvedTheme
    // Note: updatePrimaryColorMutation is stable (from useMutation), so we don't include it in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, agency, primaryColor])
  
  // Track color changes (don't auto-save)
  const updateColorFromHSL = (h: number, s: number, l: number) => {
    const hslString = `${h} ${s}% ${l}%`
    if (hslString === primaryColor) {
      setPendingColor(null)
      return
    }
    setPendingColor(hslString)
    
    // Update local state for preview
    setHue(h)
    setSaturation(s)
    setLightness(l)
    
    // Update CSS variable for preview (temporary)
    document.documentElement.style.setProperty('--primary', hslString)
    const textColor = getContrastTextColor(hslString)
    document.documentElement.style.setProperty('--primary-foreground', textColor === 'white' ? '0 0% 100%' : '0 0% 0%')
  }
  
  // Save all agency profile changes
  const handleSaveAllChanges = async () => {
    if (!agency) return

    try {
      setSavingAllChanges(true)

      const updates: any = {}

      // Save color if changed
      if (pendingColor) {
        updates.primaryColor = pendingColor
      }

      // Save display name if changed
      if (displayName !== (agency.displayName || agency.name)) {
        updates.displayName = displayName
      }

      // Save theme if changed
      if (agencyThemeMode !== agency.themeMode) {
        updates.themeMode = agencyThemeMode
      }

      // Save whitelabel domain if changed
      if (whitelabelDomain !== (agency.whitelabelDomain || '')) {
        updates.whitelabelDomain = whitelabelDomain || null
      }

      // Save logo if changed
      if (pendingLogo !== null) {
        updates.logoUrl = pendingLogo || null
      }

      if (Object.keys(updates).length === 0) {
        showWarning('No changes to save')
        return
      }

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: updates,
      })

      // Update local state
      if (pendingColor) {
        setPrimaryColor(pendingColor)
        setPendingColor(null)
      }

      if (pendingLogo !== null) {
        setPendingLogo(null)
      }

      setAgency({ ...agency, ...updates })

      // Update theme if changed
      if (updates.themeMode) {
        setTheme(agencyThemeMode)
      }

      showSuccess('Changes saved successfully')
    } catch (error) {
      console.error('Error saving changes:', error)
      showError('Failed to save changes')
    } finally {
      setSavingAllChanges(false)
    }
  }
  
  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (!agency) return false
    const currentLogo = agency.logoUrl || null
    // Logo is changed if pendingLogo is not null and different from current
    // Empty string means removal, so it's a change if current logo exists
    const logoChanged = pendingLogo !== null && (
      pendingLogo === '' ? currentLogo !== null : pendingLogo !== currentLogo
    )
    return (
      pendingColor !== null ||
      displayName !== (agency.displayName || agency.name) ||
      agencyThemeMode !== agency.themeMode ||
      whitelabelDomain !== (agency.whitelabelDomain || '') ||
      logoChanged
    )
  }

  // Undo all pending changes
  const handleUndoChanges = () => {
    if (!agency) return
    
    // Reset color
    setPendingColor(null)
    setHue(parseHSL(primaryColor).h)
    setSaturation(parseHSL(primaryColor).s)
    setLightness(parseHSL(primaryColor).l)
    
    // Reset display name
    setDisplayName(agency.displayName || agency.name)
    setDisplayNameValue(agency.displayName || agency.name)

    // Reset whitelabel domain
    setWhitelabelDomain(agency.whitelabelDomain || '')
    setWhitelabelDomainValue(agency.whitelabelDomain || '')
    
    // Reset logo
    setPendingLogo(null)
  }
  const [agencyThemeMode, setAgencyThemeMode] = useState<'light' | 'dark' | 'system'>('system')
  const [savingTheme, setSavingTheme] = useState(false)

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

  // SMS Automation state
  const [automationAgentSaving, setAutomationAgentSaving] = useState<string | null>(null)

  // Fetch agents for automation tab
  const { data: automationAgentsData, isLoading: automationAgentsLoading } = useQuery({
    queryKey: queryKeys.configurationAgentAutoSend(),
    queryFn: async () => {
      try {
        const data = await apiClient.get<{ agents?: AgentAutoSendInfo[] }>('/api/agents/auto-send/')
        return (data.agents || (data as any) || []) as AgentAutoSendInfo[]
      } catch {
        return []
      }
    },
    enabled: activeTab === 'automation',
    staleTime: 5 * 60 * 1000,
  })
  const automationAgents = automationAgentsData || []

  // ============ Payout Settings ============

  const [carrierPayoutModes, setCarrierPayoutModes] = useState<Record<string, 'submission_date' | 'policy_effective_date'>>({})
  const [savingPayoutSettings, setSavingPayoutSettings] = useState(false)

  // Fetch existing carrier payout settings from Django backend
  const { data: payoutSettingsData, isLoading: payoutSettingsLoading } = useQuery({
    queryKey: queryKeys.carrierPayoutSettings(agencyData?.id || ''),
    queryFn: async () => {
      return apiClient.get<Array<{ carrierId: string; dateMode: 'submission_date' | 'policy_effective_date' }>>(
        `/api/agencies/${agencyData!.id}/payout-settings/`
      )
    },
    enabled: activeTab === 'payout-settings' && !!agencyData?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Initialize carrier payout modes from defaults + saved settings
  useEffect(() => {
    if (!carriersData.length) return

    // Paid on draft → policy_effective_date (carrier pays when first premium collected)
    // Paid on approval/issue → submission_date (carrier pays when app submitted/approved)
    const PAID_ON_DRAFT_CARRIERS = [
      'Aetna', 'Aflac', 'AIG', 'Americo', 'Assurity', 'Baltimore Life',
      'Elco Mutual', 'F&G', 'Gerber', 'GTL', 'Fidelity Life', 'KC Life',
      'Lafayette', 'National Life Group', 'North American', 'Trinity',
      'Illinois Mutual', 'Sentinel Security'
    ]
    const PAID_ON_APPROVAL_CARRIERS = [
      'American Amicable', 'Royal Neighbors', 'TransAmerica', 'Forestors',
      'Mutual of Omaha'
    ]

    const modes: Record<string, 'submission_date' | 'policy_effective_date'> = {}

    // Set defaults based on carrier name matching
    carriersData.forEach((carrier: Carrier) => {
      const name = carrier.displayName || carrier.name
      if (PAID_ON_DRAFT_CARRIERS.some(n => name.toLowerCase().includes(n.toLowerCase()))) {
        modes[carrier.id] = 'policy_effective_date'
      } else if (PAID_ON_APPROVAL_CARRIERS.some(n => name.toLowerCase().includes(n.toLowerCase()))) {
        modes[carrier.id] = 'submission_date'
      } else {
        modes[carrier.id] = 'policy_effective_date' // default
      }
    })

    // Override with saved settings from DB (apiClient converts snake_case → camelCase)
    if (payoutSettingsData) {
      payoutSettingsData.forEach((setting: { carrierId: string; dateMode: 'submission_date' | 'policy_effective_date' }) => {
        modes[setting.carrierId] = setting.dateMode
      })
    }

    setCarrierPayoutModes(modes)
  }, [carriersData, payoutSettingsData])

  const handleSavePayoutSettings = async () => {
    if (!agencyData?.id) return
    setSavingPayoutSettings(true)
    try {
      const rows = Object.entries(carrierPayoutModes).map(([carrierId, dateMode]) => ({
        carrierId,
        dateMode,
      }))

      await apiClient.post(`/api/agencies/${agencyData.id}/payout-settings/`, { settings: rows })

      showSuccess('Payout settings saved successfully')
      if (isMounted) {
        queryClient.invalidateQueries({ queryKey: queryKeys.carrierPayoutSettings(agencyData.id) })
      }
    } catch (err: unknown) {
      console.error('Error saving payout settings:', err)
      showError(err instanceof Error ? err.message : 'Failed to save payout settings')
    } finally {
      setSavingPayoutSettings(false)
    }
  }

  // Discord Settings state
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>("")
  const [editingDiscordWebhook, setEditingDiscordWebhook] = useState(false)
  const [discordWebhookValue, setDiscordWebhookValue] = useState("")
  const [savingDiscordWebhook, setSavingDiscordWebhook] = useState(false)
  const [discordNotificationEnabled, setDiscordNotificationEnabled] = useState(false)
  const [discordNotificationTemplate, setDiscordNotificationTemplate] = useState("")
  const [discordBotUsername, setDiscordBotUsername] = useState("AgentSpace Deal Bot")

  // SMS Templates state
  const [smsWelcomeEnabled, setSmsWelcomeEnabled] = useState(true)
  const [smsWelcomeTemplate, setSmsWelcomeTemplate] = useState("")
  const [smsBillingReminderEnabled, setSmsBillingReminderEnabled] = useState(true)
  const [smsBillingReminderTemplate, setSmsBillingReminderTemplate] = useState("")
  const [smsLapseReminderEnabled, setSmsLapseReminderEnabled] = useState(true)
  const [smsLapseReminderTemplate, setSmsLapseReminderTemplate] = useState("")
  const [smsBirthdayEnabled, setSmsBirthdayEnabled] = useState(true)
  const [smsBirthdayTemplate, setSmsBirthdayTemplate] = useState("")
  // Lapse Email Notification Settings state
  const [lapseEmailEnabled, setLapseEmailEnabled] = useState(false)
  const [lapseEmailSubject, setLapseEmailSubject] = useState("Policy Lapse Alert: {{client_name}}")
  const [lapseEmailBody, setLapseEmailBody] = useState("")
  const [editingLapseSubject, setEditingLapseSubject] = useState(false)
  const [editingLapseBody, setEditingLapseBody] = useState(false)
  const [lapseSubjectValue, setLapseSubjectValue] = useState("")
  const [lapseBodyValue, setLapseBodyValue] = useState("")
  const [savingLapseEmail, setSavingLapseEmail] = useState(false)
  // New state for Supabase-style email editor
  const [emailViewMode, setEmailViewMode] = useState<'source' | 'preview'>('source')
  const [hasUnsavedEmailChanges, setHasUnsavedEmailChanges] = useState(false)
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Carrier Logins state
  const [carrierNames, setCarrierNames] = useState<string[]>([])
  const [selectedCarrierLogin, setSelectedCarrierLogin] = useState<string>("")
  const [carrierLoginUsername, setCarrierLoginUsername] = useState<string>("")
  const [carrierLoginPassword, setCarrierLoginPassword] = useState<string>("")
  const [carrierDropdownOpen, setCarrierDropdownOpen] = useState(false)
  const carrierDropdownRef = useRef<HTMLDivElement | null>(null)

  // Policy Reports state - drag and drop upload
  interface PolicyReportFile {
    id: string
    file: File
  }
  
  const [policyReportFiles, setPolicyReportFiles] = useState<PolicyReportFile[]>([])
  const [isDraggingPolicyReports, setIsDraggingPolicyReports] = useState(false)
  const [uploadingReports, setUploadingReports] = useState(false)
  const [uploadedFilesInfo, setUploadedFilesInfo] = useState<any[]>([])
  
  // All supported carriers
  const supportedCarriers = [
    'Aetna',
    'Aflac',
    'American Amicable',
    'Combined Insurance',
    'American Home Life',
    'Royal Neighbors',
    'Liberty Bankers Life',
    'Transamerica',
    'Foresters',
    'Reagan CRM Data',
    'Ethos',
    'Mutual of Omaha',
    'Americo',
  ]

  // Carriers and Products state with caching
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [carriersLoaded, setCarriersLoaded] = useState(false)
  const [allProducts, setAllProducts] = useState<Product[]>([]) // Cache all products
  const [products, setProducts] = useState<Product[]>([]) // Filtered products for display
  const [allProductsLoaded, setAllProductsLoaded] = useState(false)

  // Product editing state
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editProductFormData, setEditProductFormData] = useState<{
    name: string
    productCode: string
    isActive: boolean
  }>({ name: "", productCode: "", isActive: true })
  const [originalProductData, setOriginalProductData] = useState<{
    name: string
    productCode: string
    isActive: boolean
  } | null>(null)
  const [deleteProductConfirmOpen, setDeleteProductConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  // Positions state
  const [positions, setPositions] = useState<Position[]>([])
  const [newPosition, setNewPosition] = useState({ name: "", level: 0, description: "" })
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null)
  const [editPositionFormData, setEditPositionFormData] = useState<{
    name: string
    level: number
    description: string
    isActive: boolean
  }>({ name: "", level: 0, description: "", isActive: true })
  const [deletePositionConfirmOpen, setDeletePositionConfirmOpen] = useState(false)
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null)

  // Commissions state
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [selectedCommissionCarrier, setSelectedCommissionCarrier] = useState<string>("")
  const [commissionEdits, setCommissionEdits] = useState<Array<{ positionId: string; productId: string; commissionPercentage: number }>>([])
  const [focusedInputKey, setFocusedInputKey] = useState<string | null>(null)
  const [commissionsCarriers, setCommissionsCarriers] = useState<Carrier[]>([])

  // ============ TanStack Query Hooks ============

  // Fetch agency data via Django API
  const { data: agencyData, isLoading: loadingAgencyProfile, error: agencyError } = useAgencySettings()

  // Agency mutations via Django API
  const updateAgencySettingsMutation = useUpdateAgencySettings()
  const uploadAgencyLogoMutation = useUploadAgencyLogo()
  const updateAgencyColorMutation = useUpdateAgencyColor()

  // Fetch carriers - only when user is authenticated
  const { data: carriersData = [], isLoading: carriersLoading, error: carriersError } = useQuery({
    queryKey: queryKeys.configurationCarriers(),
    queryFn: async () => {
      return apiClient.get<Carrier[]>('/api/carriers/')
    },
    // Wait for auth to be ready before fetching
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch all products - only when user is authenticated
  const { data: allProductsData = [], isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: queryKeys.configurationProducts(),
    queryFn: async () => {
      return apiClient.get<Product[]>('/api/products/all/')
    },
    // Wait for auth to be ready before fetching
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch positions (only when positions tab is active)
  const { data: positionsData = [], isLoading: positionsLoading, error: positionsError, refetch: refetchPositions } = useQuery({
    queryKey: queryKeys.configurationPositions(),
    queryFn: async () => {
      try {
        return await apiClient.get<Position[]>('/api/positions/')
      } catch {
        return []
      }
    },
    enabled: activeTab === 'positions' && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch carriers for commissions dropdown (only carriers with products)
  const { data: commissionsCarriersData = [], isLoading: commissionsCarriersLoading } = useQuery({
    queryKey: queryKeys.configurationCommissionsCarriers(),
    queryFn: async () => {
      try {
        return await apiClient.get<Carrier[]>('/api/carriers/with-products/')
      } catch {
        return []
      }
    },
    enabled: activeTab === 'commissions' && !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch commissions (only when commissions tab is active and carrier is selected)
  const { data: commissionsData = [], isLoading: commissionsLoading, error: commissionsError, refetch: refetchCommissions } = useQuery({
    queryKey: queryKeys.configurationCommissions(selectedCommissionCarrier),
    queryFn: async () => {
      try {
        return await apiClient.get<Commission[]>('/api/positions/all-commissions/', selectedCommissionCarrier ? { params: { carrier_id: selectedCommissionCarrier } } : undefined)
      } catch {
        return []
      }
    },
    enabled: activeTab === 'commissions' && !!selectedCommissionCarrier && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch carrier names (only when carrier-logins tab is active)
  const { data: carrierNamesRawData = [], isLoading: loadingCarrierNames } = useApiFetch<Array<{id: string, name: string}>>(
    queryKeys.configurationCarrierNames(),
    '/api/carriers/names',
    {
      enabled: activeTab === 'carrier-logins',
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  )
  // Fetch existing policy files from ingest jobs (only when policy-reports tab is active)
  const { data: policyFilesData, isLoading: checkingExistingFiles, refetch: refetchPolicyFiles } = useApiFetch<{files: any[], jobs?: any[]}>(
    queryKeys.configurationPolicyFiles(),
    '/api/ingest/jobs/?days=30&limit=50',
    {
      enabled: activeTab === 'policy-reports',
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  )

  // ============ Mutations ============

  // Alias for consistency with existing code
  const updatePrimaryColorMutation = {
    mutate: ({ agencyId, color }: { agencyId: string; color: string }) => {
      updateAgencyColorMutation.mutate(
        { agencyId, primaryColor: color },
        {
          onSuccess: () => {
            // Update local state
            if (agency) {
              setAgency({ ...agency, primaryColor: color })
            }
          },
          onError: (error) => {
            console.error('Error updating primary color:', error)
          }
        }
      )
    }
  }

  // Position mutations
  const createPositionMutation = useCreatePosition()
  const updatePositionMutation = useUpdatePosition()
  const deletePositionMutation = useDeletePosition()

  // Product mutations
  const updateProductMutation = useUpdateProduct()
  const deleteProductMutation = useDeleteProduct()
  const saveCommissionsMutation = useSaveProductCommissions()
  const syncCommissionsMutation = useSyncCommissions()

  // Carrier mutations
  const saveCarrierLoginMutation = useSaveCarrierLogin()

  // Policy report mutations
  const createPolicyJobMutation = useCreatePolicyReportJob()
  const signPolicyFilesMutation = useSignPolicyReportFiles()

  // Derived loading states from mutations (replaces useState-based loading states)
  const savingPosition = createPositionMutation.isPending || updatePositionMutation.isPending
  const deletingPosition = deletePositionMutation.isPending
  const updatingProduct = updateProductMutation.isPending
  const deletingProduct = deleteProductMutation.isPending
  const savingCommissions = saveCommissionsMutation.isPending
  const syncingMissingCommissions = syncCommissionsMutation.isPending

  // ============ Sync query data to local state ============

  // Sync agency data to local state
  useEffect(() => {
    if (agencyData) {
      console.log('[Config Page] Loading agency data into state')
      console.log('[Config Page] Discord notification enabled:', agencyData.discordNotificationEnabled)
      console.log('[Config Page] Discord notification template:', agencyData.discordNotificationTemplate)

      setAgency(agencyData)
      setDisplayName(agencyData.displayName || agencyData.name)
      setPrimaryColor(agencyData.primaryColor || "217 91% 60%")
      setLeadSources(agencyData.leadSources || [])
      setAgencyPhoneNumber(agencyData.phoneNumber || "")
      setMessagingEnabled(agencyData.messagingEnabled || false)
      setDiscordWebhookUrl(agencyData.discordWebhookUrl || "")
      setDiscordNotificationEnabled(agencyData.discordNotificationEnabled ?? false)
      setDiscordNotificationTemplate(agencyData.discordNotificationTemplate || "")
      setDiscordBotUsername(agencyData.discordBotUsername || "AgentSpace Deal Bot")
      setWhitelabelDomain(agencyData.whitelabelDomain || "")
      setSmsWelcomeEnabled(agencyData.smsWelcomeEnabled ?? true)
      setSmsWelcomeTemplate(agencyData.smsWelcomeTemplate || "")
      setSmsBillingReminderEnabled(agencyData.smsBillingReminderEnabled ?? true)
      setSmsBillingReminderTemplate(agencyData.smsBillingReminderTemplate || "")
      setSmsLapseReminderEnabled(agencyData.smsLapseReminderEnabled ?? true)
      setSmsLapseReminderTemplate(agencyData.smsLapseReminderTemplate || "")
      setSmsBirthdayEnabled(agencyData.smsBirthdayEnabled ?? true)
      setSmsBirthdayTemplate(agencyData.smsBirthdayTemplate || "")
      setLapseEmailEnabled(agencyData.lapseEmailNotificationsEnabled || false)
      setLapseEmailSubject(agencyData.lapseEmailSubject || "Policy Lapse Alert: {{client_name}}")
      setLapseEmailBody(agencyData.lapseEmailBody || "")
      setLapseSubjectValue(agencyData.lapseEmailSubject || "Policy Lapse Alert: {{client_name}}")
      setLapseBodyValue(agencyData.lapseEmailBody || "")
    }
  }, [agencyData])

  // Sync carriers to local state
  useEffect(() => {
    if (carriersData.length > 0) {
      setCarriers(carriersData)
      setCarriersLoaded(true)
    }
  }, [carriersData])

  // Sync products to local state
  useEffect(() => {
    if (allProductsData.length > 0) {
      setAllProducts(allProductsData)
      setAllProductsLoaded(true)
    }
  }, [allProductsData])

  // Sync positions to local state
  useEffect(() => {
    if (positionsData.length > 0) {
      setPositions(positionsData)
    }
  }, [positionsData])

  // Sync commissions to local state
  useEffect(() => {
    if (commissionsData.length > 0) {
      setCommissions(commissionsData)
    }
  }, [commissionsData])

  // Sync commissions carriers to local state
  useEffect(() => {
    if (commissionsCarriersData.length > 0) {
      setCommissionsCarriers(commissionsCarriersData)
    }
  }, [commissionsCarriersData])

  // Sync carrier names to local state
  useEffect(() => {
    if (carrierNamesRawData.length > 0) {
      setCarrierNames(carrierNamesRawData.map((c) => c.name))
    }
  }, [carrierNamesRawData])

  // Sync policy files to local state
  useEffect(() => {
    if (policyFilesData?.files) {
      setUploadedFilesInfo(policyFilesData.files)
    }
  }, [policyFilesData])

  // ============ Original useEffects (keeping non-fetch logic) ============

  // Sync theme state when user changes (e.g., after login or theme update)
  useEffect(() => {
    if (user?.themeMode) {
      setAgencyThemeMode(user.themeMode)
    }
  }, [user?.themeMode])

  // Close carrier dropdown when clicking outside
  useEffect(() => {
    if (!carrierDropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        carrierDropdownRef.current &&
        !carrierDropdownRef.current.contains(event.target as Node)
      ) {
        setCarrierDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [carrierDropdownOpen])

  // Filter products when carrier is selected
  useEffect(() => {
    if (selectedCarrier && allProducts.length > 0) {
      const filteredProducts = allProducts.filter(product => product.carrierId === selectedCarrier)
      setProducts(filteredProducts)
    } else {
      setProducts([])
    }
  }, [selectedCarrier, allProducts])

  // Agency Profile Management Functions
  const handleEditDisplayName = () => {
    setEditingDisplayName(true)
    setDisplayNameValue(displayName)
  }

  const handleSaveDisplayName = async () => {
    if (!agency) return

    try {
      setSavingDisplayName(true)

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: {
          name: displayNameValue.trim(),
          displayName: displayNameValue.trim()
        },
      })

      setDisplayName(displayNameValue.trim())
      setEditingDisplayName(false)
      setDisplayNameValue("")
    } catch (error) {
      console.error('Error updating display name:', error)
      showError('Failed to update display name')
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
      showError('Agency information not loaded. Please refresh the page.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      showWarning('File size must be less than 5MB')
      return
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      showWarning('Please upload a valid image file (PNG, JPG, SVG, or WebP)')
      return
    }

    try {
      setUploadingLogo(true)

      console.log('Starting logo upload...', {
        agencyId: agency.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })

      // Upload via Django API
      const result = await uploadAgencyLogoMutation.mutateAsync({
        agencyId: agency.id,
        file,
      })

      console.log('Upload successful:', result)

      // Add timestamp query parameter to bust browser and CDN cache
      const cacheBustedUrl = `${result.logoUrl}?t=${Date.now()}`

      console.log('Public URL generated:', cacheBustedUrl)

      // Set pending logo instead of saving to database immediately
      setPendingLogo(cacheBustedUrl)

      // Extract dominant color from the uploaded image (use original URL without cache param)
      await extractDominantColor(result.logoUrl)
    } catch (error) {
      console.error('Error uploading logo:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      showError(`Failed to upload logo: ${errorMessage}. Check console for details.`)
    } finally {
      setUploadingLogo(false)
    }
  }

  // Extract dominant color from logo
  const extractDominantColor = async (imageUrl: string) => {
    try {
      const img = new window.Image()
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
          try {
            await updateAgencyColorMutation.mutateAsync({
              agencyId: agency.id,
              primaryColor: suggestedColor,
            })

            setPrimaryColor(suggestedColor)
            document.documentElement.style.setProperty('--primary', suggestedColor)

            // Set the foreground color based on the primary color's luminance
            const textColor = getContrastTextColor(suggestedColor)
            document.documentElement.style.setProperty('--primary-foreground', textColor === 'white' ? '0 0% 100%' : '0 0% 0%')
          } catch (colorError) {
            console.error('Error updating primary color:', colorError)
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

  const handleRemoveLogo = () => {
    // Set pending logo to empty string to indicate removal
    // If there's an existing logo, we want to remove it
    // If there's a pending upload, we want to cancel it
    setPendingLogo('')
  }


  const handleThemeChange = async (newTheme: ThemeMode) => {
    if (!agency) return

    const previousTheme = agencyThemeMode
    setAgencyThemeMode(newTheme)
    setTheme(newTheme)

    // Update primary color if switching between light/dark with default colors
    const currentResolved = resolvedTheme || (previousTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : previousTheme)
    const newResolved = newTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : newTheme

    if (isDefaultColorForMode(primaryColor, currentResolved as 'light' | 'dark') && currentResolved !== newResolved) {
      const newColor = getDefaultPrimaryColor(newResolved as 'light' | 'dark')
      setPrimaryColor(newColor)
      setPendingColor(null)
      setAgency({ ...agency, primaryColor: newColor })
      document.documentElement.style.setProperty('--primary', newColor)
      const textColor = getContrastTextColor(newColor)
      document.documentElement.style.setProperty('--primary-foreground', textColor === 'white' ? '0 0% 100%' : '0 0% 0%')

      // Update agency color using proper mutation (not fire-and-forget)
      updatePrimaryColorMutation.mutate({ agencyId: agency.id, color: newColor })
    }

    setSavingTheme(true)
    const result = await updateUserTheme(newTheme)
    setSavingTheme(false)

    if (result.success) {
      await refreshUser()
    } else {
      showError('Failed to update theme preference')
      setAgencyThemeMode(previousTheme)
      setTheme(previousTheme)
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

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { whitelabelDomain: whitelabelDomainValue.trim() || null },
      })

      setWhitelabelDomain(whitelabelDomainValue.trim())
      setAgency({ ...agency, whitelabelDomain: whitelabelDomainValue.trim() || null })
      setEditingWhitelabelDomain(false)
    } catch (error) {
      console.error('Error updating whitelabel domain:', error)
      showError('Failed to update whitelabel domain')
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
      showWarning('Please enter a position name and level')
      return
    }

    createPositionMutation.mutate(
      {
        name: newPosition.name.trim(),
        level: newPosition.level,
        description: newPosition.description.trim() || null,
      },
      {
        onSuccess: async () => {
          setNewPosition({ name: "", level: 0, description: "" })
          // Auto-sync commissions for all carriers when a new position is added
          console.log('New position added, auto-syncing commissions for all carriers...')
          await syncCommissionsForAllCarriers()
        },
        onError: (error) => {
          console.error('Error creating position:', error)
          showError(error instanceof Error ? error.message : 'Failed to create position')
        },
      }
    )
  }

  const [originalPositionData, setOriginalPositionData] = useState<{
    name: string
    level: number
    description: string
    isActive: boolean
  } | null>(null)

  const handleEditPosition = (position: Position) => {
    setEditingPositionId(position.positionId)
    const formData = {
      name: position.name,
      level: position.level,
      description: position.description || "",
      isActive: position.isActive
    }
    setEditPositionFormData(formData)
    setOriginalPositionData(formData)
  }

  const handleSavePositionEdit = async () => {
    if (!editingPositionId || !editPositionFormData) {
      showError('No position selected for editing')
      return
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(editingPositionId)) {
      console.error('Invalid position ID format:', editingPositionId)
      showError('Invalid position ID. Please refresh the page and try again.')
      return
    }

    // Validate required fields
    if (!editPositionFormData.name.trim()) {
      showError('Position name is required')
      return
    }

    if (editPositionFormData.level < 0 || !Number.isInteger(editPositionFormData.level)) {
      showError('Level must be a positive integer')
      return
    }

    const shouldSyncCommissions = originalPositionData && editPositionFormData.isActive !== originalPositionData.isActive

    console.log('[Position Update] Saving position:', {
      positionId: editingPositionId,
      positionIdLength: editingPositionId.length,
      name: editPositionFormData.name.trim(),
      level: editPositionFormData.level,
      isActive: editPositionFormData.isActive,
    })

    updatePositionMutation.mutate(
      {
        positionId: editingPositionId,
        name: editPositionFormData.name.trim(),
        level: editPositionFormData.level,
        description: editPositionFormData.description || null,
        isActive: editPositionFormData.isActive,
      },
      {
        onSuccess: async () => {
          showSuccess('Position updated successfully')
          // Auto-sync commissions for all carriers if position was activated/deactivated
          if (shouldSyncCommissions) {
            console.log('Position activation changed, auto-syncing commissions for all carriers...')
            await syncCommissionsForAllCarriers()
          }
          setEditingPositionId(null)
          setOriginalPositionData(null)
        },
        onError: (error) => {
          console.error('Error updating position:', error)
          showError(error instanceof Error ? error.message : 'Failed to update position')
        },
      }
    )
  }

  const handleDeletePosition = (position: Position) => {
    setPositionToDelete(position)
    setDeletePositionConfirmOpen(true)
  }

  const handleConfirmPositionDelete = async () => {
    if (!positionToDelete) return

    deletePositionMutation.mutate(
      { positionId: positionToDelete.positionId },
      {
        onSuccess: () => {
          setDeletePositionConfirmOpen(false)
          setPositionToDelete(null)
        },
        onError: (error) => {
          console.error('Error deleting position:', error)
          showError(error instanceof Error ? error.message : 'Failed to delete position')
        },
      }
    )
  }

  // Commission management functions
  const handleCommissionChange = (positionId: string, productId: string, value: string, originalValue?: number) => {
    // Allow empty string while typing
    if (value === '') {
      setCommissionEdits(prev => prev.filter(edit => !(edit.positionId === positionId && edit.productId === productId)))
      return
    }

    // Remove leading zeros (e.g., "032" -> "32", but keep "0.5" as is)
    let cleanedValue = value
    if (cleanedValue.length > 1 && cleanedValue[0] === '0' && cleanedValue[1] !== '.' && cleanedValue[1] !== ',') {
      cleanedValue = cleanedValue.replace(/^0+/, '') || '0'
    }

    const numValue = parseFloat(cleanedValue)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 999.99) {
      // Only track as edit if it's different from original value
      const original = originalValue ?? 0
      if (numValue !== original) {
        setCommissionEdits(prev => {
          // Remove existing edit for this position/product combo if it exists
          const filtered = prev.filter(edit => !(edit.positionId === positionId && edit.productId === productId))
          // Add the new edit
          return [...filtered, { positionId: positionId, productId: productId, commissionPercentage: numValue }]
        })
      } else {
        // Value matches original, remove from edits
        setCommissionEdits(prev => prev.filter(edit => !(edit.positionId === positionId && edit.productId === productId)))
      }
    }
  }

  const handleSaveCommissions = async () => {
    console.log('[Save] Commission edits:', commissionEdits)
    
    if (commissionEdits.length === 0) {
      showWarning('No changes to save')
      return
    }

    console.log('[Save] Sending to API:', { commissions: commissionEdits })

    saveCommissionsMutation.mutate(
      { commissions: commissionEdits },
      {
        onSuccess: (data) => {
          console.log('[Save] Success:', data)
          setCommissionEdits([])
          refetchCommissions()
          showSuccess('Commissions saved successfully!')
        },
        onError: (error) => {
          console.error('[Save] Error:', error)
          showError(error instanceof Error ? error.message : 'Failed to save commissions')
        },
      }
    )
  }

  // Helper function to sync commissions for a specific carrier (silently)
  const syncCommissionsForCarrier = async (carrierId: string, forceRefresh: boolean = false): Promise<void> => {
    try {
      const data = await apiClient.post<{ created?: number }>('/api/positions/product-commissions/sync/', undefined, { params: { carrier_id: carrierId } })
      console.log(`Auto-synced commissions for carrier ${carrierId}: created ${data.created || 0} entries`)

      // Refresh commissions only when we added new entries and this carrier is active.
      // Avoid forcing a refetch here to prevent double-loading; the tab/useEffect will handle initial fetch.
      if ((data.created ?? 0) > 0 && selectedCommissionCarrier === carrierId) {
        await refetchCommissions()
      }
    } catch (error) {
      // Log error but don't interrupt user workflow
      console.error(`Error auto-syncing commissions for carrier ${carrierId}:`, error)
    }
  }

  // Helper function to sync commissions for all carriers (silently)
  const syncCommissionsForAllCarriers = async (): Promise<void> => {
    try {
      console.log('Auto-syncing commissions for all active carriers...')

      // Sync for all active carriers
      const activeCarriers = carriers.filter(c => c.isActive)
      for (const carrier of activeCarriers) {
        await syncCommissionsForCarrier(carrier.id, false)
      }

      console.log(`Completed auto-sync for ${activeCarriers.length} carriers`)
    } catch (error) {
      console.error('Error auto-syncing commissions for all carriers:', error)
    }
  }

  const handleSyncMissingCommissions = async (silent: boolean = false) => {
    if (!selectedCommissionCarrier) {
      if (!silent) {
        showWarning('Please select a carrier first')
      }
      return
    }

    syncCommissionsMutation.mutate(
      { carrierId: selectedCommissionCarrier },
      {
        onSuccess: async (data) => {
          if (!silent) {
            if (data.created === 0) {
              showWarning('All products for this carrier already have commission entries!')
            } else {
              showSuccess(`Successfully created ${data.created} missing commission entries for this carrier!`)
            }
          }
          // Only refresh the commissions view if new commissions were created
          if (data.created > 0) {
            await refetchCommissions()
          }
        },
        onError: (error) => {
          console.error('Error syncing commissions:', error)
          if (!silent) {
            showError(error instanceof Error ? error.message : 'Failed to sync commissions')
          }
        },
      }
    )
  }

  // Product management functions (keeping existing code)
  const handleProductCreated = async (newProduct: Product) => {
    setAllProducts(prev => [...prev, newProduct])

    if (newProduct.carrierId === selectedCarrier) {
      setProducts(prev => [...prev, newProduct])
    }

    const existingCarrier = carriers.find(carrier => carrier.id === newProduct.carrierId)
    if (!existingCarrier) {
      try {
        const updatedCarriers = await apiClient.get<Carrier[]>('/api/carriers/')
        setCarriers(updatedCarriers)
      } catch (error) {
        console.error('Error refreshing carriers:', error)
      }
    }

    // Auto-sync commissions for this product's carrier (always sync, even if inactive)
    console.log(`Product created/updated for carrier ${newProduct.carrierId}, auto-syncing commissions...`)
    await syncCommissionsForCarrier(newProduct.carrierId, false)
  }

  const handleEditProduct = (product: Product) => {
    const formData = {
      name: product.name,
      productCode: product.productCode || "",
      isActive: product.isActive
    }
    setEditingProductId(product.id)
    setEditProductFormData(formData)
    setOriginalProductData(formData)
  }

  const handleCancelProductEdit = () => {
    setEditingProductId(null)
    setEditProductFormData({ name: "", productCode: "", isActive: true })
    setOriginalProductData(null)
  }

  const handleSaveProductEdit = async () => {
    if (!editingProductId || !originalProductData) return

    const hasChanges = (
      editProductFormData.name !== originalProductData.name ||
      editProductFormData.productCode !== originalProductData.productCode ||
      editProductFormData.isActive !== originalProductData.isActive
    )

    if (!hasChanges) {
      setEditingProductId(null)
      setEditProductFormData({ name: "", productCode: "", isActive: true })
      setOriginalProductData(null)
      return
    }

    const wasActivationChange = editProductFormData.isActive !== originalProductData.isActive
    const productCarrierId = allProducts.find(p => p.id === editingProductId)?.carrierId
    const productIdToUpdate = editingProductId

    updateProductMutation.mutate(
      {
        productId: editingProductId,
        name: editProductFormData.name,
        productCode: editProductFormData.productCode || null,
        isActive: editProductFormData.isActive,
      },
      {
        onSuccess: async () => {
          const updatedProduct = {
            name: editProductFormData.name,
            productCode: editProductFormData.productCode || undefined,
            isActive: editProductFormData.isActive,
          }

          setAllProducts(prev =>
            prev.map(product =>
              product.id === productIdToUpdate
                ? { ...product, ...updatedProduct }
                : product
            )
          )

          setProducts(prev =>
            prev.map(product =>
              product.id === productIdToUpdate
                ? { ...product, ...updatedProduct }
                : product
            )
          )

          setEditingProductId(null)
          setEditProductFormData({ name: "", productCode: "", isActive: true })
          setOriginalProductData(null)

          // Auto-sync commissions if product was activated/deactivated
          if (wasActivationChange && productCarrierId) {
            console.log(`Product activation changed for carrier ${productCarrierId}, auto-syncing commissions...`)
            await syncCommissionsForCarrier(productCarrierId, false)
          }
        },
        onError: (error) => {
          console.error('Error updating product:', error)
          showError(error instanceof Error ? error.message : 'Failed to update product')
        },
      }
    )
  }

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product)
    setDeleteProductConfirmOpen(true)
  }

  const handleConfirmProductDelete = async () => {
    if (!productToDelete) return

    const productId = productToDelete.id
    const productCarrierId = productToDelete.carrierId

    deleteProductMutation.mutate(
      { productId },
      {
        onSuccess: () => {
          setAllProducts(prev => prev.filter(product => product.id !== productId))
          setProducts(prev => prev.filter(product => product.id !== productId))

          const remainingProductsForCarrier = allProducts.filter(
            product => product.id !== productId && product.carrierId === productCarrierId
          )

          // If no remaining products for carrier, invalidate carriers query to refresh
          if (remainingProductsForCarrier.length === 0) {
            if (isMounted) {
              queryClient.invalidateQueries({ queryKey: queryKeys.configurationCarriers() })
            }
            if (selectedCarrier === productCarrierId) {
              setSelectedCarrier("")
            }
          }

          setDeleteProductConfirmOpen(false)
          setProductToDelete(null)
        },
        onError: (error) => {
          console.error('Error deleting product:', error)
          showError(error instanceof Error ? error.message : 'Failed to delete product')
        },
      }
    )
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
    setEditProductFormData({ name: "", productCode: "", isActive: true })
    setOriginalProductData(null)
  }

  // Lead Sources Management Functions
  const handleAddLeadSource = async () => {
    if (!newLeadSource.trim() || !agency) return

    const updatedLeadSources = [...leadSources, newLeadSource.trim()]

    try {
      setSavingLeadSources(true)

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { leadSources: updatedLeadSources },
      })

      setLeadSources(updatedLeadSources)
      setNewLeadSource("")
    } catch (error) {
      console.error('Error adding lead source:', error)
      showError('Failed to add lead source')
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

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { leadSources: updatedLeadSources },
      })

      setLeadSources(updatedLeadSources)
      setEditingLeadSourceIndex(null)
      setEditLeadSourceValue("")
    } catch (error) {
      console.error('Error updating lead source:', error)
      showError('Failed to update lead source')
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

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { leadSources: updatedLeadSources },
      })

      setLeadSources(updatedLeadSources)
    } catch (error) {
      console.error('Error deleting lead source:', error)
      showError('Failed to delete lead source')
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

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { phoneNumber: phoneNumberValue.trim() || null },
      })

      setAgencyPhoneNumber(phoneNumberValue.trim())
      setEditingPhoneNumber(false)
      setPhoneNumberValue("")
    } catch (error) {
      console.error('Error updating phone number:', error)
      showError('Failed to update phone number')
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

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { messagingEnabled: enabled },
      })

      setMessagingEnabled(enabled)
    } catch (error) {
      console.error('Error updating messaging settings:', error)
      showError('Failed to update messaging settings')
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

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { discordWebhookUrl: discordWebhookValue.trim() || null },
      })

      setDiscordWebhookUrl(discordWebhookValue.trim())
      setEditingDiscordWebhook(false)
      setDiscordWebhookValue("")
    } catch (error) {
      console.error('Error updating Discord webhook:', error)
      showError('Failed to update Discord webhook URL')
    } finally {
      setSavingDiscordWebhook(false)
    }
  }

  const handleCancelDiscordWebhookEdit = () => {
    setEditingDiscordWebhook(false)
    setDiscordWebhookValue("")
  }

  // Lapse Email Notification Management Functions
  const handleToggleLapseEmail = async (enabled: boolean) => {
    if (!agency) return

    try {
      setSavingLapseEmail(true)

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { lapseEmailNotificationsEnabled: enabled },
      })

      setLapseEmailEnabled(enabled)
      showSuccess(enabled ? 'Lapse email notifications enabled' : 'Lapse email notifications disabled')
    } catch (error) {
      console.error('Error updating lapse email setting:', error)
      showError('Failed to update notification setting')
      setLapseEmailEnabled(!enabled)
    } finally {
      setSavingLapseEmail(false)
    }
  }

  const handleEditLapseSubject = () => {
    setEditingLapseSubject(true)
    setLapseSubjectValue(lapseEmailSubject)
  }

  const handleSaveLapseSubject = async () => {
    if (!agency || !lapseSubjectValue.trim()) return

    try {
      setSavingLapseEmail(true)

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { lapseEmailSubject: lapseSubjectValue.trim() },
      })

      setLapseEmailSubject(lapseSubjectValue.trim())
      setEditingLapseSubject(false)
      setLapseSubjectValue("")
      showSuccess('Email subject updated')
    } catch (error) {
      console.error('Error updating email subject:', error)
      showError('Failed to update email subject')
    } finally {
      setSavingLapseEmail(false)
    }
  }

  const handleCancelLapseSubjectEdit = () => {
    setEditingLapseSubject(false)
    setLapseSubjectValue("")
  }

  const handleEditLapseBody = () => {
    setEditingLapseBody(true)
    setLapseBodyValue(lapseEmailBody)
  }

  const handleSaveLapseBody = async () => {
    if (!agency) return

    try {
      setSavingLapseEmail(true)

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: { lapseEmailBody: lapseBodyValue },
      })

      setLapseEmailBody(lapseBodyValue)
      setEditingLapseBody(false)
      setLapseBodyValue("")
      showSuccess('Email template updated')
    } catch (error) {
      console.error('Error updating email template:', error)
      showError('Failed to update email template')
    } finally {
      setSavingLapseEmail(false)
    }
  }

  const handleCancelLapseBodyEdit = () => {
    setEditingLapseBody(false)
    setLapseBodyValue("")
  }

  // Email template helper data and functions
  const samplePlaceholders = {
    client_name: 'John Smith',
    premium: '$125.00',
    carrier: 'Mutual of Omaha',
    policy_number: 'POL-123456',
    agent_name: 'Jane Doe',
    policy_effective_date: '01/15/2024'
  }

  const emailPlaceholders = [
    { label: 'client_name', value: '{{client_name}}' },
    { label: 'premium', value: '{{premium}}' },
    { label: 'carrier', value: '{{carrier}}' },
    { label: 'policy_number', value: '{{policy_number}}' },
    { label: 'agent_name', value: '{{agent_name}}' },
    { label: 'policy_effective_date', value: '{{policy_effective_date}}' },
  ]

  const insertPlaceholder = (placeholder: string) => {
    const textarea = bodyTextareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = lapseBodyValue.slice(0, start) + placeholder + lapseBodyValue.slice(end)
    setLapseBodyValue(newValue)
    setHasUnsavedEmailChanges(true)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length)
    }, 0)
  }

  const getPreviewHtml = () => {
    let html = lapseBodyValue
    // Replace placeholders with sample values
    Object.entries(samplePlaceholders).forEach(([key, value]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    })
    // Convert newlines to <br> tags for proper display
    html = html.replace(/\n/g, '<br />')
    return html
  }

  const handleSaveEmailTemplate = async () => {
    if (!agency) return

    try {
      setSavingLapseEmail(true)

      const updates: { lapseEmailSubject?: string; lapseEmailBody?: string } = {}

      if (lapseSubjectValue.trim() && lapseSubjectValue.trim() !== lapseEmailSubject) {
        updates.lapseEmailSubject = lapseSubjectValue.trim()
      }

      if (lapseBodyValue !== lapseEmailBody) {
        updates.lapseEmailBody = lapseBodyValue
      }

      if (Object.keys(updates).length === 0) {
        showWarning('No changes to save')
        return
      }

      await updateAgencySettingsMutation.mutateAsync({
        agencyId: agency.id,
        data: updates,
      })

      if (updates.lapseEmailSubject) {
        setLapseEmailSubject(updates.lapseEmailSubject)
      }
      if (updates.lapseEmailBody !== undefined) {
        setLapseEmailBody(updates.lapseEmailBody)
      }

      setHasUnsavedEmailChanges(false)
      showSuccess('Email template saved')
    } catch (error) {
      console.error('Error saving email template:', error)
      showError('Failed to save email template')
    } finally {
      setSavingLapseEmail(false)
    }
  }

  // Policy Reports Management Functions
  // Drag and drop handlers for policy reports
  const handlePolicyReportDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingPolicyReports(true)
  }

  const handlePolicyReportDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingPolicyReports(false)
  }

  const handlePolicyReportDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handlePolicyReportDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingPolicyReports(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = droppedFiles.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return extension === 'csv' || extension === 'xlsx' || extension === 'xls'
    })

    if (validFiles.length === 0) {
      showWarning('Please drop CSV or Excel files only.')
      return
    }

    const newFiles: PolicyReportFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file
    }))

    setPolicyReportFiles(prev => [...prev, ...newFiles])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const validFiles = selectedFiles.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return extension === 'csv' || extension === 'xlsx' || extension === 'xls'
    })

    if (validFiles.length === 0) {
      showWarning('Please select CSV or Excel files only.')
      return
    }

    const newFiles: PolicyReportFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file
    }))

    setPolicyReportFiles(prev => [...prev, ...newFiles])
    
    // Reset input
    if (e.target) {
      e.target.value = ''
    }
  }

  const handleFileRemove = (fileId: string) => {
    setPolicyReportFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const handleAnalyzePersistency = async () => {
    if (policyReportFiles.length === 0) {
      showWarning('Please upload at least one policy report before analyzing.')
      return
    }

    try {
      setUploadingReports(true)

      // 0) Create an ingest job first
      const expectedFiles = policyReportFiles.length
      const clientJobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // Resolve agencyId from current user context
      const agencyId = user?.agencyId

      if (!agencyId) {
        showError('Could not resolve your agency. Please refresh and try again.')
        return
      }

      const jobJson = await apiClient.post<{ job: { jobId: string } }>('/api/ingest/jobs/', {
        expectedFiles,
        clientJobId,
      })
      if (!jobJson?.job?.jobId) {
        console.error('Failed to create ingest job', { body: jobJson })
        showError('Could not start ingest job. Please try again.')
        return
      }
      const jobId = jobJson.job.jobId as string
      console.debug('Created ingest job', { jobId, expectedFiles })

      // 1) Request presigned URLs for all files in a single call (Django direct)
      const signJson = await apiClient.post<{ files: Array<{ fileId: string; fileName: string; presignedUrl: string }> }>(
        '/api/ingest/presign/',
        {
          jobId,
          files: policyReportFiles.map(({ file }) => ({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          })),
        },
        { skipCaseConversion: true }
      )
      if (!Array.isArray(signJson?.files)) {
        console.error('Presign failed', { body: signJson })
        showError('Could not generate upload URLs. Please try again.')
        return
      }

      // 2) Upload each file via its presigned URL (no chunking; URLs expire in 60s)
      const results = await Promise.allSettled(
        signJson.files.map(async (f) => {
            const match = policyReportFiles.find(pf => pf.file.name === f.fileName)
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
        showSuccess(`Successfully uploaded ${successes.length} file(s).`)
        setPolicyReportFiles([])
        refetchPolicyFiles()
      } else {
        showWarning(`Uploaded ${successes.length} file(s), but ${failures.length} failed: ${failures.join(', ')}`)
      }
    } catch (err) {
      console.error('Unexpected error during upload:', err);
      showError('An unexpected error occurred while uploading. Please try again.')
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
    { id: "automation" as TabType, label: "Automation", icon: Bell },
    { id: "email-notifications" as TabType, label: "Email Notifications", icon: Mail },
    { id: "policy-reports" as TabType, label: "Policy Reports", icon: BarChart3 },
    { id: "carrier-logins" as TabType, label: "Carrier Logins", icon: Lock },
    { id: "discord" as TabType, label: "Discord Notifications", icon: Bell },
    { id: "sms-templates" as TabType, label: "SMS Templates", icon: MessageCircle },
    { id: "payout-settings" as TabType, label: "Payout Settings", icon: Calendar },
    { id: "scoreboard" as TabType, label: "Scoreboard", icon: TrendingUp },
  ]

  // Tab metadata with titles and descriptions for page headers
  const TAB_META: Record<TabType, { title: string; description: string }> = {
    "agency-profile": { title: "Agency Profile", description: "Customize your agency branding and appearance" },
    "carriers": { title: "Carriers & Products", description: "Manage insurance carriers and their product offerings" },
    "positions": { title: "Positions", description: "Configure agent positions and organizational hierarchy" },
    "commissions": { title: "Commissions", description: "Set up commission structures and percentage splits" },
    "lead-sources": { title: "Lead Sources", description: "Track and manage where your leads originate" },
    "messaging": { title: "Messaging", description: "Configure SMS and messaging preferences" },
    "automation": { title: "SMS Automation", description: "Control automatic sending of SMS messages vs draft creation" },
    "email-notifications": { title: "Email Notifications", description: "Set up automated email notification rules" },
    "policy-reports": { title: "Policy Reports", description: "Upload and manage carrier policy reports" },
    "carrier-logins": { title: "Carrier Logins", description: "Store carrier portal credentials securely" },
    "discord": { title: "Discord Notifications", description: "Connect Discord webhooks for team alerts" },
    "sms-templates": { title: "SMS Templates", description: "Create and customize SMS message templates" },
    "payout-settings": { title: "Payout Settings", description: "Configure which date each carrier uses for expected payout calculations" },
    "scoreboard": { title: "Scoreboard", description: "Configure scoreboard visibility settings for your agents" },
  }

  // Get commissions grid data
  const getCommissionsGrid = () => {
    if (!selectedCommissionCarrier || commissions.length === 0) return null

    // Filter commissions for selected carrier
    const carrierCommissions = commissions.filter(c => c.carrierId === selectedCommissionCarrier)

    if (carrierCommissions.length === 0) return null

    console.log('[Commission Grid] Building grid from commissions:', {
      totalCommissions: carrierCommissions.length,
      sampleCommission: carrierCommissions[0] ? {
        commissionId: carrierCommissions[0].commissionId,
        positionId: carrierCommissions[0].positionId,
        positionIdLength: carrierCommissions[0].positionId?.length,
        positionIdType: typeof carrierCommissions[0].positionId,
        productId: carrierCommissions[0].productId,
        productIdLength: carrierCommissions[0].productId?.length,
        productIdType: typeof carrierCommissions[0].productId,
      } : null,
      allPositionIds: carrierCommissions.map(c => ({
        id: c.positionId,
        length: c.positionId?.length
      })),
      allProductIds: carrierCommissions.map(c => ({
        id: c.productId,
        length: c.productId?.length
      })),
    })

    // Get unique positions and products
    const uniquePositions = Array.from(new Set(carrierCommissions.map(c => c.positionId)))
      .map(posId => {
        const comm = carrierCommissions.find(c => c.positionId === posId)!
        return { id: posId, name: comm.positionName, level: comm.positionLevel }
      })
      .sort((a, b) => b.level - a.level) // Sort by level descending

    const uniqueProducts = Array.from(new Set(carrierCommissions.map(c => c.productId)))
      .map(prodId => {
        const comm = carrierCommissions.find(c => c.productId === prodId)!
        return { id: prodId, name: comm.productName }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    console.log('[Commission Grid] Grid data created:', {
      positionsCount: uniquePositions.length,
      productsCount: uniqueProducts.length,
      samplePosition: uniquePositions[0] ? {
        id: uniquePositions[0].id,
        idLength: uniquePositions[0].id?.length,
        name: uniquePositions[0].name,
      } : null,
      sampleProduct: uniqueProducts[0] ? {
        id: uniqueProducts[0].id,
        idLength: uniqueProducts[0].id?.length,
        name: uniqueProducts[0].name,
      } : null,
    })

    return { positions: uniquePositions, products: uniqueProducts, commissions: carrierCommissions }
  }

  const gridData = getCommissionsGrid()

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-72 bg-card border-r border-border flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="p-4 border-b border-border">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>

        <div className="px-6 py-4">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Settings</h1>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3 mt-auto">
          <Link
            href="/user/profile"
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <User className="h-4 w-4 flex-shrink-0" />
            <span>Profile</span>
          </Link>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-1">{TAB_META[activeTab].title}</h2>
            <p className="text-sm text-muted-foreground">{TAB_META[activeTab].description}</p>
          </div>

          {agencyError && (
            <div className="mb-4">
              <QueryErrorDisplay
                error={agencyError}
                onRetry={() => {
                  if (isMounted) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.configurationAgency() })
                  }
                }}
                variant="inline"
              />
            </div>
          )}
          {carriersError && (
            <div className="mb-4">
              <QueryErrorDisplay
                error={carriersError}
                onRetry={() => {
                  if (isMounted) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.configurationCarriers() })
                  }
                }}
                variant="inline"
              />
            </div>
          )}
          {productsError && (
            <div className="mb-4">
              <QueryErrorDisplay
                error={productsError}
                onRetry={() => {
                  if (isMounted) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.configurationProducts() })
                  }
                }}
                variant="inline"
              />
            </div>
          )}
          {positionsError && (
            <div className="mb-4">
              <QueryErrorDisplay
                error={positionsError}
                onRetry={() => {
                  if (isMounted) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.configurationPositions() })
                  }
                }}
                variant="inline"
              />
            </div>
          )}
          {commissionsError && (
            <div className="mb-4">
              <QueryErrorDisplay
                error={commissionsError}
                onRetry={() => {
                  if (isMounted) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.configurationCommissions(selectedCommissionCarrier) })
                  }
                }}
                variant="inline"
              />
            </div>
          )}

          {/* Tab Content Area */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            {/* Agency Profile Tab */}
            {activeTab === "agency-profile" && (
              <div>
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
                              backgroundColor: `hsl(${pendingColor || primaryColor} / 0.1)`,
                              color: `hsl(${pendingColor || primaryColor})`
                            }}
                          >
                            <Edit className="h-6 w-6" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Agency Logo and Primary Color Scheme - Side by Side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Agency Logo */}
                      <div className="bg-accent/30 rounded-lg p-6 border border-border">
                        <h3 className="text-xl font-semibold text-foreground mb-4">Agency Logo</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Upload your agency logo. This will replace the default icon in the navigation sidebar. Recommended size: 200x200px or larger, square format.
                        </p>

                        <div className="flex flex-col gap-4">
                          {/* Drag and Drop Upload Area */}
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
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              setIsDragging(true)
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault()
                              setIsDragging(false)
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              setIsDragging(false)
                              const file = e.dataTransfer.files?.[0]
                              if (file && file.type.startsWith('image/')) {
                                handleLogoUpload(file)
                              }
                            }}
                            onClick={() => document.getElementById('logo-upload')?.click()}
                            className={cn(
                              "flex flex-col items-center justify-center w-full h-48 bg-card rounded-lg border-2 border-dashed transition-colors cursor-pointer",
                              isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent/30",
                              uploadingLogo && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {(pendingLogo && pendingLogo !== '' ? pendingLogo : agency?.logoUrl) ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <img
                                  src={pendingLogo && pendingLogo !== '' ? pendingLogo : agency?.logoUrl || undefined}
                                  alt="Agency Logo"
                                  className="max-w-full max-h-full object-contain p-2"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    console.error('Error loading logo:', pendingLogo || agency?.logoUrl)
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                                  <div className="opacity-0 hover:opacity-100 transition-opacity bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                                    Click to replace
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-muted-foreground">
                                <Upload className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p className="text-sm font-medium mb-1">Drag and drop your logo here</p>
                                <p className="text-xs">or click to browse</p>
                              </div>
                            )}
                          </div>

                          {/* Upload Button */}
                          <div className="flex flex-col gap-3">
                            <label
                              htmlFor="logo-upload"
                              className={cn(
                                "cursor-pointer inline-flex items-center justify-center px-6 py-2.5 rounded-lg transition-colors font-medium w-auto",
                                uploadingLogo && "opacity-50 cursor-not-allowed"
                              )}
                              style={{
                                backgroundColor: `hsl(${pendingColor || primaryColor})`,
                                color: getContrastTextColor(pendingColor || primaryColor) === 'white' ? '#ffffff' : '#000000'
                              }}
                            >
                              {uploadingLogo ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  {(pendingLogo && pendingLogo !== '' ? pendingLogo : agency?.logoUrl) ? 'Replace Logo' : 'Upload Logo'}
                                </>
                              )}
                            </label>
                            {pendingLogo !== null && (
                              <Button
                                onClick={handleRemoveLogo}
                                disabled={uploadingLogo}
                                variant="outline"
                                className="border-red-300 text-red-600 hover:bg-red-50 w-auto"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {pendingLogo === '' ? 'Undo Remove' : 'Remove Logo'}
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
                        {/* Color Picker - At Top */}
                        <div className="flex justify-center">
                          <HexColorPicker
                            color={hslToHex(primaryColor)}
                            onChange={(hex) => {
                              const hsl = hexToHSL(hex)
                              const parsed = parseHSL(hsl)
                              setHue(parsed.h)
                              setSaturation(parsed.s)
                              setLightness(parsed.l)
                              updateColorFromHSL(parsed.h, parsed.s, parsed.l)
                            }}
                            style={{ width: '220px', height: '220px' }}
                          />
                        </div>

                        {/* Current Color Display - Below Picker */}
                        <div className="flex items-center justify-center gap-4">
                          <div
                            className="w-20 h-20 rounded-lg border-2 border-gray-200 shadow-sm"
                            style={{ backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)` }}
                          />
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {pendingColor ? 'Preview Color' : 'Current Color'}
                            </p>
                            <p className="text-lg font-mono text-foreground">
                              {pendingColor || primaryColor}
                            </p>
                            <p className="text-sm font-mono text-muted-foreground">
                              {hslToHex(pendingColor || primaryColor)}
                            </p>
                            {pendingColor && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Unsaved changes
                              </p>
                            )}
                          </div>
                        </div>

                        {/* HSL Inputs - Three separate inputs */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Hue
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max="360"
                              value={hue}
                              onChange={(e) => {
                                const h = parseInt(e.target.value) || 0
                                const clampedH = Math.max(0, Math.min(360, h))
                                setHue(clampedH)
                                updateColorFromHSL(clampedH, saturation, lightness)
                              }}
                              className="h-10 font-mono"
                              disabled={savingColor}
                            />
                            <p className="text-xs text-muted-foreground mt-1">0-360</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Saturation
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={saturation}
                              onChange={(e) => {
                                const s = parseInt(e.target.value) || 0
                                const clampedS = Math.max(0, Math.min(100, s))
                                setSaturation(clampedS)
                                updateColorFromHSL(hue, clampedS, lightness)
                              }}
                              className="h-10 font-mono"
                              disabled={savingColor}
                            />
                            <p className="text-xs text-muted-foreground mt-1">0-100%</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Lightness
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={lightness}
                              onChange={(e) => {
                                const l = parseInt(e.target.value) || 0
                                const clampedL = Math.max(0, Math.min(100, l))
                                setLightness(clampedL)
                                updateColorFromHSL(hue, saturation, clampedL)
                              }}
                              className="h-10 font-mono"
                              disabled={savingColor}
                            />
                            <p className="text-xs text-muted-foreground mt-1">0-100%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Theme Preference */}
                    <div className="bg-accent/30 rounded-lg p-6 border border-border">
                      <h3 className="text-xl font-semibold text-foreground mb-4">
                        <Moon className="h-5 w-5 inline mr-2" />
                        Theme Preference
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Choose your personal theme preference. This setting only affects your account and will override the agency default theme.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Light Theme Option */}
                        <button
                          onClick={() => handleThemeChange('light')}
                          disabled={savingTheme}
                          className={cn(
                            "relative p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                            agencyThemeMode === 'light'
                              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50 shadow-lg"
                              : "border-border bg-card hover:border-blue-300 dark:hover:border-blue-600"
                          )}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Sun className={cn(
                              "h-10 w-10",
                              agencyThemeMode === 'light' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold text-lg",
                                agencyThemeMode === 'light' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                              )}>
                                Light
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Bright, clean interface
                              </p>
                            </div>
                            {agencyThemeMode === 'light' && (
                              <div className="absolute top-3 right-3">
                                <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50 shadow-lg"
                              : "border-border bg-card hover:border-blue-300 dark:hover:border-blue-600"
                          )}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Moon className={cn(
                              "h-10 w-10",
                              agencyThemeMode === 'dark' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold text-lg",
                                agencyThemeMode === 'dark' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                              )}>
                                Dark
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Easy on the eyes
                              </p>
                            </div>
                            {agencyThemeMode === 'dark' && (
                              <div className="absolute top-3 right-3">
                                <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50 shadow-lg"
                              : "border-border bg-card hover:border-blue-300 dark:hover:border-blue-600"
                          )}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Monitor className={cn(
                              "h-10 w-10",
                              agencyThemeMode === 'system' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold text-lg",
                                agencyThemeMode === 'system' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                              )}>
                                System
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Follow device settings
                              </p>
                            </div>
                            {agencyThemeMode === 'system' && (
                              <div className="absolute top-3 right-3">
                                <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                              backgroundColor: `hsl(${pendingColor || primaryColor} / 0.1)`,
                              color: `hsl(${pendingColor || primaryColor})`
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
                              {(pendingLogo && pendingLogo !== '' ? pendingLogo : agency?.logoUrl) ? (
                                <img
                                  src={pendingLogo && pendingLogo !== '' ? pendingLogo : agency?.logoUrl || undefined}
                                  alt="Logo Preview"
                                  className="w-10 h-10 rounded-xl object-contain"
                                  crossOrigin="anonymous"
                                />
                              ) : (
                                <div
                                  className="flex items-center justify-center w-10 h-10 rounded-xl text-white font-bold text-lg"
                                  style={{ backgroundColor: `hsl(${pendingColor || primaryColor})` }}
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
                            <h1
                              className="text-3xl font-bold dark:text-white"
                              style={theme === 'dark' ? {} : { color: `hsl(${pendingColor || primaryColor})` }}
                            >
                              Agents
                            </h1>

                            {/* Button Examples */}
                            <div className="flex flex-wrap gap-3">
                              <button
                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                style={{
                                  backgroundColor: `hsl(${pendingColor || primaryColor})`,
                                  color: getContrastTextColor(pendingColor || primaryColor) === 'white' ? '#ffffff' : '#000000'
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
                                  backgroundColor: `hsl(${pendingColor || primaryColor})`,
                                  color: getContrastTextColor(pendingColor || primaryColor) === 'white' ? '#ffffff' : '#000000'
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
                  
                  {/* Save All Changes and Undo Changes Buttons */}
                  {hasUnsavedChanges() && (
                    <div className="mt-8 pt-6 border-t border-border">
                      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="text-blue-800 dark:text-blue-200">
                          <p className="font-semibold">You have unsaved changes</p>
                          <p className="text-sm">Save your changes to update the website appearance</p>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onClick={handleUndoChanges}
                            disabled={savingAllChanges}
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30 font-semibold px-6 py-2"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Undo Changes
                          </Button>
                          <Button
                            onClick={handleSaveAllChanges}
                            disabled={savingAllChanges}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2"
                          >
                            {savingAllChanges ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Save All Changes
                              </>
                            )}
                          </Button>
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
                          className="group relative bg-white dark:bg-black/30 hover:bg-blue-50 dark:hover:bg-card/80 border border-border dark:border-gray-500 hover:border-primary dark:hover:border-primary/70 rounded-lg p-6 transition-all duration-200 hover:shadow-lg dark:hover:shadow-primary/20 hover:scale-[1.02] active:scale-100"
                        >
                          <div className="flex items-center justify-center h-24">
                            <span className="text-lg font-semibold text-foreground dark:text-gray-200 group-hover:text-primary dark:group-hover:text-gray-200 text-center">
                              {carrier.displayName}
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
                      <thead className="bg-accent/50">
                        <tr className="border-b-2 border-border">
                          <th className="text-left py-4 px-6 font-bold text-muted-foreground">Position Name</th>
                          <th className="text-left py-4 px-6 font-bold text-muted-foreground">Level</th>
                          <th className="text-left py-4 px-6 font-bold text-muted-foreground">Description</th>
                          <th className="text-left py-4 px-6 font-bold text-muted-foreground">Status</th>
                          <th className="text-right py-4 px-6 font-bold text-muted-foreground">Actions</th>
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
                            <tr key={position.positionId} className="border-b border-border hover:bg-accent/30 dark:hover:bg-accent/20 transition-colors">
                              <td className="py-5 px-6">
                                {editingPositionId === position.positionId ? (
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
                                {editingPositionId === position.positionId ? (
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
                                {editingPositionId === position.positionId ? (
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
                                {editingPositionId === position.positionId ? (
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={editPositionFormData.isActive}
                                      onCheckedChange={(checked) => setEditPositionFormData(prev => ({ ...prev, isActive: checked as boolean }))}
                                    />
                                    <span className="text-sm">{editPositionFormData.isActive ? "Active" : "Inactive"}</span>
                                  </div>
                                ) : (
                                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    position.isActive
                                      ? "bg-green-100 text-green-800 border border-green-300"
                                      : "bg-red-100 text-red-800 border border-red-300"
                                  }`}>
                                    {position.isActive ? "Active" : "Inactive"}
                                  </span>
                                )}
                              </td>
                              <td className="py-5 px-6">
                                <div className="flex items-center justify-end space-x-2 relative z-10">
                                  {editingPositionId === position.positionId ? (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSavePositionEdit()
                                        }}
                                        disabled={savingPosition}
                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 p-2 bg-green-50 dark:bg-green-950/50 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                                        type="button"
                                      >
                                        <Check className="h-5 w-5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingPositionId(null)
                                          setOriginalPositionData(null)
                                        }}
                                        disabled={savingPosition}
                                        className="text-muted-foreground hover:text-foreground p-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                                        type="button"
                                      >
                                        <X className="h-5 w-5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleEditPosition(position)
                                        }}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors relative z-10"
                                        type="button"
                                      >
                                        <Edit className="h-5 w-5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeletePosition(position)
                                        }}
                                        type="button"
                                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-2 bg-red-50 dark:bg-red-950/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors relative z-10"
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
                          onChange={async (e) => {
                            const carrierId = e.target.value
                            setSelectedCommissionCarrier(carrierId)
                            setCommissionEdits([])
                            
                            // If a carrier is selected, automatically sync missing commissions (silently)
                            // The sync function will fetch commissions at the end, so no need to fetch here
                            if (carrierId) {
                              // Always sync when a carrier is selected to ensure all products/positions are covered
                              setTimeout(async () => {
                                console.log(`Carrier ${carrierId} selected, auto-syncing commissions...`)
                                await syncCommissionsForCarrier(carrierId, true)
                              }, 200)
                            }
                          }}
                          className="w-full md:w-96 h-12 px-4 rounded-lg border border-border bg-white dark:bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={commissionsCarriersLoading}
                        >
                          <option value="">-- Select a carrier --</option>
                          {commissionsCarriersLoading ? (
                            <option value="" disabled>Loading carriers...</option>
                          ) : (
                            commissionsCarriers.map((carrier) => (
                              <option key={carrier.id} value={carrier.id}>
                                {carrier.displayName}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      {selectedCommissionCarrier && (
                        <Button
                          onClick={() => handleSyncMissingCommissions(false)}
                          disabled={syncingMissingCommissions}
                          className="h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-sm hover:shadow-md transition-all whitespace-nowrap text-sm sm:text-base"
                        >
                          {syncingMissingCommissions ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              <span className="hidden sm:inline">Syncing...</span>
                              <span className="sm:hidden">Syncing...</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">Sync Products/Positions</span>
                              <span className="sm:hidden">Sync</span>
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
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <>
                       <div className="table-container mb-4" style={{ paddingLeft: 0, overflow: 'hidden' }}>
                         <div className="table-wrapper custom-scrollbar max-h-[600px] overflow-y-auto overflow-x-auto" style={{ paddingLeft: 0, marginLeft: 0 }}>
                          <table className="jira-table min-w-full" style={{ marginLeft: 0, borderSpacing: 0, borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                              <tr>
                                <th 
                                  className="border-r border-border border-b border-border pos-col-header" 
                                  style={{ 
                                    position: 'sticky',
                                    left: 0,
                                    top: 0,
                                    zIndex: 300,
                                    backgroundColor: 'hsl(var(--accent))',
                                    paddingLeft: '1rem',
                                    paddingRight: '1rem',
                                    marginLeft: 0,
                                    marginRight: 0,
                                    minWidth: '150px',
                                    boxShadow: '8px 0 12px -4px rgba(0, 0, 0, 0.2), 4px 0 4px -2px rgba(0, 0, 0, 0.1)'
                                  }}
                                >
                                  Position
                                </th>
                                {gridData.products.map((product) => (
                                  <th key={product.id} className="text-center min-w-[150px] bg-accent border-b border-border header-cell" style={{ backgroundColor: 'hsl(var(--accent))' }}>
                                    {product.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {gridData.positions.map((position) => (
                                <tr key={position.id} className="hover:bg-accent/30 dark:hover:bg-accent/20 transition-colors group">
                                  <td className="font-semibold bg-card transition-colors border-r border-border pos-col" style={{ position: 'sticky', left: 0, zIndex: 1, paddingLeft: '1rem', paddingRight: '1rem', marginLeft: 0, marginRight: 0, boxShadow: '8px 0 12px -4px rgba(0, 0, 0, 0.2), 4px 0 4px -2px rgba(0, 0, 0, 0.1)', minWidth: '150px' }}>
                                    {position.name}
                                    <span className="ml-2 text-xs text-muted-foreground">(Level {position.level})</span>
                                  </td>
                                  {gridData.products.map((product) => {
                                    const commission = gridData.commissions.find(
                                      c => c.positionId === position.id && c.productId === product.id
                                    )
                                    
                                    // Log first entry to see what IDs look like when creating keys
                                    if (position.id === gridData.positions[0]?.id && product.id === gridData.products[0]?.id) {
                                      console.log('[Commission Table] Creating key for first cell:', {
                                        positionId: position.id,
                                        positionIdLength: position.id?.length,
                                        positionIdType: typeof position.id,
                                        productId: product.id,
                                        productIdLength: product.id?.length,
                                        productIdType: typeof product.id,
                                        commissionPositionId: commission?.positionId,
                                        commissionPositionIdLength: commission?.positionId?.length,
                                        commissionProductId: commission?.productId,
                                        commissionProductIdLength: commission?.productId?.length,
                                      })
                                    }
                                    
                                    const key = `${position.id}-${product.id}`
                                    const editedValue = commissionEdits.find(
                                      edit => edit.positionId === position.id && edit.productId === product.id
                                    )?.commissionPercentage
                                    const originalValue = commission?.commissionPercentage
                                    const currentValue = editedValue !== undefined ? editedValue : originalValue
                                    const isFocused = focusedInputKey === key
                                    const isZero = currentValue === 0 || currentValue === undefined || currentValue === null
                                    
                                    // If focused and value is 0, show empty; otherwise show the value
                                    // Convert to string for display, handling the zero case
                                    let displayValue: string | number = ''
                                    if (isFocused && isZero) {
                                      displayValue = ''
                                    } else if (currentValue !== undefined && currentValue !== null) {
                                      displayValue = currentValue
                                    }

                                    return (
                                      <td key={product.id} className="text-center">
                                        <div className="cell-wrapper relative inline-flex items-center justify-center">
                                          <Input
                                            type="number"
                                            value={displayValue}
                                            onChange={(e) => {
                                              const val = e.target.value
                                              // Normalize leading zeros (e.g., "032" -> "32", but keep "0.5")
                                              // This is handled in handleCommissionChange
                                              handleCommissionChange(position.id, product.id, val, originalValue)
                                            }}
                                            onFocus={(e) => {
                                              setFocusedInputKey(key)
                                              // If value is 0 or empty, clear it to allow starting from scratch
                                              if (isZero) {
                                                // Value will be cleared via displayValue logic
                                                // Don't select, just let user type
                                              } else {
                                                // Otherwise, select all text to allow easy overwrite
                                                e.target.select()
                                              }
                                            }}
                                            onBlur={() => {
                                              setFocusedInputKey(null)
                                            }}
                                            placeholder="0.00"
                                            step="0.01"
                                            min="0"
                                            max="999.99"
                                            className={cn(
                                              "h-10 w-28 text-center pr-6 no-spinner bg-background text-foreground",
                                              editedValue !== undefined && "border-blue-500 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-400 dark:text-foreground"
                                            )}
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">%</span>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {commissionEdits.length > 0 && (
                        <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
                          <div className="text-foreground">
                            <p className="font-semibold">{commissionEdits.length} unsaved changes</p>
                            <p className="text-sm text-muted-foreground">Click Save to apply your commission changes</p>
                          </div>
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setCommissionEdits([])}
                              disabled={savingCommissions}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleSaveCommissions()
                              }}
                              disabled={savingCommissions || commissionEdits.length === 0}
                              className="bg-primary hover:bg-primary/90"
                              type="button"
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
                            className="flex-1 h-12 text-lg font-mono bg-accent/40"
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
                          <div className="flex-1 rounded-lg border border-border bg-accent/40 p-4">
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
                          <h3 className="text-xl font-semibold text-foreground mb-2">Enable Automated Messaging and Notifications</h3>
                          <p className="text-sm text-muted-foreground">
                            When enabled, automated messages will be sent for birthdays, billing reminders, and lapse notifications.
                            When disabled, no automated messages will be sent to your clients and no notifications will be sent to your agents.
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

              {/* SMS Automation Tab */}
              {activeTab === "automation" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-1">SMS Automation</h2>
                    <p className="text-sm text-muted-foreground">
                      Control whether automated messages are sent immediately or saved as drafts
                    </p>
                  </div>
                  <SmsAutomationSettings
                    smsAutoSendEnabled={agencyData?.smsAutoSendEnabled ?? true}
                    onAutoSendEnabledChange={async (enabled) => {
                      if (!agencyData?.id) return
                      try {
                        await apiClient.patch(`/api/agencies/${agencyData.id}/settings/`, { smsAutoSendEnabled: enabled })
                        queryClient.invalidateQueries({ queryKey: queryKeys.configurationAgency() })
                        showSuccess(`SMS auto-send ${enabled ? 'enabled' : 'disabled'}`)
                      } catch {
                        showError('Failed to update auto-send setting')
                      }
                    }}
                    typeOverrides={{}}
                    onTypeOverrideChange={() => {}}
                    saving={false}
                    agents={automationAgents}
                    agentsLoading={automationAgentsLoading}
                    onAgentToggle={async (agentId, value) => {
                      setAutomationAgentSaving(agentId)
                      try {
                        await apiClient.patch('/api/agents/auto-send/', { agentId: agentId, smsAutoSendEnabled: value })
                        queryClient.invalidateQueries({ queryKey: queryKeys.configurationAgentAutoSend() })
                      } catch {
                        showError('Failed to update agent auto-send setting')
                      } finally {
                        setAutomationAgentSaving(null)
                      }
                    }}
                    agentSaving={automationAgentSaving}
                  />
                </div>
              )}

              {/* Policy Reports Tab - Drag and Drop Upload */}
              {activeTab === "policy-reports" && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Policy Reports</h2>
                    <p className="text-sm text-muted-foreground">Drag and drop CSV or Excel files for any carrier to analyze persistency rates</p>
                  </div>

                  {checkingExistingFiles && uploadedFilesInfo.length === 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking for existing uploads...</span>
                    </div>
                  )}

                  {uploadedFilesInfo.length > 0 && (
                    <div className="mb-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-blue-800 dark:text-blue-200">
                        <strong>{uploadedFilesInfo.length} file(s) uploaded</strong> across {policyFilesData?.jobs?.length || 0} job(s). Files are being processed by Lambda.
                      </p>
                    </div>
                  )}

                  {/* Supported Carriers List */}
                  <div className="mb-4 p-4 bg-muted/50 rounded-lg border border-border">
                    <p className="text-sm font-semibold text-foreground mb-2">Supported Carriers:</p>
                    <div className="flex flex-wrap gap-2">
                      {supportedCarriers.map((carrier) => (
                        <span
                          key={carrier}
                          className="text-xs px-2 py-1 bg-background border border-border rounded-md text-muted-foreground"
                        >
                          {carrier}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Drag and Drop Area */}
                  <div
                    onDragEnter={handlePolicyReportDragEnter}
                    onDragOver={handlePolicyReportDragOver}
                    onDragLeave={handlePolicyReportDragLeave}
                    onDrop={handlePolicyReportDrop}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-12 mb-6 transition-colors",
                      isDraggingPolicyReports
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 bg-transparent dark:bg-slate-900/40"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center text-center">
                      <Upload className={cn(
                        "h-16 w-16 mb-4 transition-colors",
                        isDraggingPolicyReports
                          ? "text-primary"
                          : "text-gray-400 dark:text-gray-300"
                      )} />
                      <p className="text-lg font-medium text-foreground mb-2">
                        {isDraggingPolicyReports ? "Drop files here" : "Drag and drop files here"}
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to browse
                      </p>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileInputChange}
                        multiple
                        className="hidden"
                        id="policy-report-upload"
                      />
                      <label
                        htmlFor="policy-report-upload"
                        className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-md text-sm font-medium transition-colors inline-block"
                      >
                        Choose Files
                      </label>
                      <p className="text-xs text-muted-foreground mt-4">
                        Supported formats: CSV, XLSX, XLS
                      </p>
                    </div>
                  </div>

                  {/* Uploaded Files List */}
                  {policyReportFiles.length > 0 && (
                    <div className="mb-6 space-y-3">
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        Uploaded Files ({policyReportFiles.length})
                      </h3>
                      <div className="space-y-2">
                        {policyReportFiles.map((fileItem) => (
                          <div
                            key={fileItem.id}
                            className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                          >
                            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {fileItem.file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(fileItem.file.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                            <Button
                              onClick={() => handleFileRemove(fileItem.id)}
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <Button
                      onClick={handleAnalyzePersistency}
                      disabled={uploadingReports || policyReportFiles.length === 0}
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

                  <div className="mt-8 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">Instructions</h3>
                    <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200 list-disc list-inside">
                      <li>Drag and drop one or more CSV or Excel files into the upload area above</li>
                      <li>Files will be automatically processed to calculate persistency rates and track policy status</li>
                      <li>New uploads will replace any existing files for the same carrier</li>
                      <li>Supported carriers: {supportedCarriers.join(', ')}</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Email Notifications Tab */}
              {activeTab === "email-notifications" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Email Notifications</h2>
                    <p className="text-sm text-muted-foreground">
                      Configure email templates for policy alerts
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Lapse Notification Settings */}
                    <div className="bg-accent/30 rounded-lg border border-border overflow-hidden">
                      {/* Enable Toggle */}
                      <div className="flex items-center justify-between p-4 border-b border-border">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleLapseEmail(!lapseEmailEnabled)}
                            disabled={savingLapseEmail}
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                              lapseEmailEnabled ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600",
                              savingLapseEmail && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                                lapseEmailEnabled ? "translate-x-4" : "translate-x-0.5"
                              )}
                            />
                          </button>
                          <span className="font-medium text-foreground">Enable Lapse Email Notifications</span>
                        </div>
                      </div>

                      {/* Subject Field */}
                      <div className="p-4 border-b border-border">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Subject
                        </label>
                        <Input
                          value={lapseSubjectValue || lapseEmailSubject}
                          onChange={(e) => {
                            setLapseSubjectValue(e.target.value)
                            setHasUnsavedEmailChanges(true)
                          }}
                          className="h-10 text-sm font-mono bg-background dark:bg-accent/40 border-border"
                          placeholder="Enter email subject..."
                          disabled={savingLapseEmail}
                        />
                      </div>

                      {/* Body Section */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-foreground">
                            Body
                          </label>
                          {/* Source/Preview Toggle */}
                          <div className="flex rounded-md border border-border overflow-hidden">
                            <button
                              onClick={() => setEmailViewMode('source')}
                              className={cn(
                                "px-3 py-1 text-xs font-medium transition-colors",
                                emailViewMode === 'source'
                                  ? "bg-foreground text-background"
                                  : "bg-background text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Source
                            </button>
                            <button
                              onClick={() => setEmailViewMode('preview')}
                              className={cn(
                                "px-3 py-1 text-xs font-medium transition-colors border-l border-border",
                                emailViewMode === 'preview'
                                  ? "bg-foreground text-background"
                                  : "bg-background text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Preview
                            </button>
                          </div>
                        </div>

                        {/* Source Editor */}
                        {emailViewMode === 'source' && (
                          <textarea
                            ref={bodyTextareaRef}
                            value={lapseBodyValue || lapseEmailBody}
                            onChange={(e) => {
                              setLapseBodyValue(e.target.value)
                              setHasUnsavedEmailChanges(true)
                            }}
                            className="w-full h-72 p-4 border border-border rounded-lg font-mono text-sm resize-none bg-zinc-900 dark:bg-zinc-950 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Enter your HTML email template..."
                            disabled={savingLapseEmail}
                          />
                        )}

                        {/* Preview Panel */}
                        {emailViewMode === 'preview' && (
                          <div className="w-full h-72 p-4 border border-border rounded-lg bg-white dark:bg-zinc-900 overflow-auto">
                            <div
                              className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                              dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                            />
                          </div>
                        )}

                        {/* Variable Buttons */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          {emailPlaceholders.map((placeholder) => (
                            <button
                              key={placeholder.label}
                              onClick={() => insertPlaceholder(placeholder.value)}
                              disabled={emailViewMode === 'preview'}
                              className={cn(
                                "px-3 py-1.5 text-xs font-mono rounded-md border transition-colors",
                                emailViewMode === 'preview'
                                  ? "border-border text-muted-foreground bg-accent/30 cursor-not-allowed"
                                  : "border-border text-foreground bg-accent/50 hover:bg-accent hover:border-foreground/30"
                              )}
                            >
                              {placeholder.value}
                            </button>
                          ))}
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end mt-6">
                          <Button
                            onClick={handleSaveEmailTemplate}
                            disabled={savingLapseEmail || !hasUnsavedEmailChanges}
                            className="bg-green-600 hover:bg-green-700 text-white px-6"
                          >
                            {savingLapseEmail ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save changes'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">How It Works</h3>
                      <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                        <li>When a policy status changes to "lapse pending" or "lapse", the system sends an email to the writing agent and all their uplines.</li>
                        <li>Use the placeholders above to personalize the email with policy details.</li>
                      </ul>
                    </div>

                    {/* Warning if disabled */}
                    {!lapseEmailEnabled && (
                      <div className="bg-amber-50 dark:bg-amber-950/50 rounded-lg p-4 border border-amber-200 dark:border-amber-800/50">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>Note:</strong> Lapse email notifications are currently disabled. Enable the toggle above to start receiving alerts.
                        </p>
                      </div>
                    )}
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
                            className="flex-1 h-12 text-sm font-mono dark:bg-accent/40"
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
                          <div className="flex-1 rounded-lg border-2 border-gray-200 dark:border-border bg-white dark:bg-accent/40 p-4">
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

                    {/* Discord Template Editor */}
                    {discordWebhookUrl && (
                      <DiscordTemplateEditor
                        enabled={discordNotificationEnabled}
                        template={discordNotificationTemplate}
                        botUsername={discordBotUsername}
                        agencyId={agency?.id}
                        onEnabledChange={setDiscordNotificationEnabled}
                        onTemplateChange={setDiscordNotificationTemplate}
                        onBotUsernameChange={setDiscordBotUsername}
                        showSuccess={showSuccess}
                        showError={showError}
                      />
                    )}

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

              {/* Carrier Logins Tab */}
              {activeTab === "carrier-logins" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Carrier Logins</h2>
                    <p className="text-sm text-muted-foreground">Manage your carrier platform credentials</p>
                  </div>

                  <div className="space-y-6">
                    {/* Carrier Selection Dropdown */}
                    <div className="bg-accent/30 rounded-lg p-6 border border-border">
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Select Carrier
                      </label>
                      <div className="relative" ref={carrierDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setCarrierDropdownOpen((open) => !open)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
                            "hover:bg-accent/60 focus:outline-none focus:ring-2 focus:ring-ring"
                          )}
                        >
                          <span className={cn("truncate", !selectedCarrierLogin && "text-muted-foreground")}>
                            {selectedCarrierLogin || "Select a carrier..."}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">▼</span>
                        </button>
                        {carrierDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
                            {loadingCarrierNames ? (
                              <div className="p-2 text-sm text-muted-foreground">Loading carriers...</div>
                            ) : carrierNames.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">No carriers available</div>
                            ) : (
                              carrierNames.map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCarrierLogin(name)
                                    setCarrierLoginUsername("")
                                    setCarrierLoginPassword("")
                                    setCarrierDropdownOpen(false)
                                  }}
                                  className={cn(
                                    "flex w-full items-center px-3 py-2 text-sm text-left hover:bg-accent",
                                    selectedCarrierLogin === name && "bg-accent"
                                  )}
                                >
                                  {name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Login Interface */}
                    {selectedCarrierLogin && (
                      <div className="bg-card rounded-lg shadow-sm border border-border p-8 max-w-md mx-auto">
                        {/* Header with back arrow, logo, and close */}
                        <div className="flex items-center justify-between mb-8">
                          <button
                            onClick={() => {
                              setSelectedCarrierLogin("")
                              setCarrierLoginUsername("")
                              setCarrierLoginPassword("")
                            }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ArrowLeft className="h-5 w-5" />
                          </button>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                              <Lock className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-sm font-semibold">AgentSpace</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCarrierLogin("")
                              setCarrierLoginUsername("")
                              setCarrierLoginPassword("")
                            }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        {/* Instructions */}
                        <div className="mb-8 text-center">
                          <h3 className="text-2xl font-bold text-foreground mb-3">Enter your credentials</h3>
                          <p className="text-sm text-muted-foreground">
                            By providing your {selectedCarrierLogin} credentials to AgentSpace, you're enabling AgentSpace to retrieve your financial data.
                          </p>
                        </div>

                        {/* Username Field */}
                        <div className="mb-4">
                          <label className="text-sm font-medium text-foreground mb-2 block">
                            Username
                          </label>
                          <div className="relative">
                            <Input
                              type="text"
                              value={carrierLoginUsername}
                              onChange={(e) => setCarrierLoginUsername(e.target.value)}
                              placeholder="Enter username"
                              className="pr-10"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>

                        {/* Password Field */}
                        <div className="mb-6">
                          <label className="text-sm font-medium text-foreground mb-2 block">
                            Password
                          </label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={carrierLoginPassword}
                              onChange={(e) => setCarrierLoginPassword(e.target.value)}
                              placeholder="Enter password"
                              className="pr-10"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                          className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                          disabled={!carrierLoginUsername || !carrierLoginPassword || saveCarrierLoginMutation.isPending}
                          onClick={() => {
                            if (!selectedCarrierLogin || !carrierLoginUsername || !carrierLoginPassword) return

                            saveCarrierLoginMutation.mutate(
                              {
                                carrierName: selectedCarrierLogin,
                                login: carrierLoginUsername,
                                password: carrierLoginPassword,
                              },
                              {
                                onSuccess: () => {
                                  showSuccess('Carrier login saved successfully.')
                                  // Clear credentials so user can enter another or switch carriers without reload
                                  setCarrierLoginUsername("")
                                  setCarrierLoginPassword("")
                                },
                                onError: (error) => {
                                  console.error('Error saving carrier login:', error)
                                  showError(error instanceof Error ? error.message : 'Failed to save carrier login.')
                                },
                              }
                            )
                          }}
                        >
                          {saveCarrierLoginMutation.isPending ? 'Saving...' : 'Submit'}
                        </Button>
                      </div>
                    )}

                    {/* Empty State */}
                    {!selectedCarrierLogin && (
                      <div className="bg-accent/30 rounded-lg p-12 border border-border text-center">
                        <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Select a carrier from the dropdown above to add your login credentials.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SMS Templates Tab */}
              {activeTab === "sms-templates" && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-foreground mb-1">SMS Templates</h2>
                    <p className="text-sm text-muted-foreground">
                      Customize automated SMS messages sent to your clients. Use placeholders to personalize messages.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <SmsTemplateEditor
                      title="Welcome Message"
                      description="Sent when a new client conversation is created."
                      placeholders={SMS_TEMPLATE_PLACEHOLDERS.welcome}
                      enabled={smsWelcomeEnabled}
                      template={smsWelcomeTemplate}
                      defaultTemplate={DEFAULT_SMS_TEMPLATES.welcome}
                      dbFieldEnabled="smsWelcomeEnabled"
                      dbFieldTemplate="smsWelcomeTemplate"
                      agencyId={agency?.id}
                      onEnabledChange={setSmsWelcomeEnabled}
                      onTemplateChange={setSmsWelcomeTemplate}
                      showSuccess={showSuccess}
                      showError={showError}
                    />

                    <SmsTemplateEditor
                      title="Billing Reminder"
                      description="Sent 3 days before premium payment is due."
                      placeholders={SMS_TEMPLATE_PLACEHOLDERS.billing_reminder}
                      enabled={smsBillingReminderEnabled}
                      template={smsBillingReminderTemplate}
                      defaultTemplate={DEFAULT_SMS_TEMPLATES.billing_reminder}
                      dbFieldEnabled="smsBillingReminderEnabled"
                      dbFieldTemplate="smsBillingReminderTemplate"
                      agencyId={agency?.id}
                      onEnabledChange={setSmsBillingReminderEnabled}
                      onTemplateChange={setSmsBillingReminderTemplate}
                      showSuccess={showSuccess}
                      showError={showError}
                    />

                    <SmsTemplateEditor
                      title="Lapse Reminder"
                      description="Sent when a policy enters lapse pending status."
                      placeholders={SMS_TEMPLATE_PLACEHOLDERS.lapse_reminder}
                      enabled={smsLapseReminderEnabled}
                      template={smsLapseReminderTemplate}
                      defaultTemplate={DEFAULT_SMS_TEMPLATES.lapse_reminder}
                      dbFieldEnabled="smsLapseReminderEnabled"
                      dbFieldTemplate="smsLapseReminderTemplate"
                      agencyId={agency?.id}
                      onEnabledChange={setSmsLapseReminderEnabled}
                      onTemplateChange={setSmsLapseReminderTemplate}
                      showSuccess={showSuccess}
                      showError={showError}
                    />

                    <SmsTemplateEditor
                      title="Birthday Message"
                      description="Sent on the client's birthday."
                      placeholders={SMS_TEMPLATE_PLACEHOLDERS.birthday}
                      enabled={smsBirthdayEnabled}
                      template={smsBirthdayTemplate}
                      defaultTemplate={DEFAULT_SMS_TEMPLATES.birthday}
                      dbFieldEnabled="smsBirthdayEnabled"
                      dbFieldTemplate="smsBirthdayTemplate"
                      agencyId={agency?.id}
                      onEnabledChange={setSmsBirthdayEnabled}
                      onTemplateChange={setSmsBirthdayTemplate}
                      showSuccess={showSuccess}
                      showError={showError}
                    />
                  </div>
                </div>
              )}

              {/* Payout Settings Tab */}
              {activeTab === "payout-settings" && (
                <div>
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground">
                      Configure whether each carrier pays based on the submission date (Paid on Approval) or the policy effective date (Paid on Draft). This affects expected payout calculations.
                    </p>
                  </div>

                  {carriersLoading || payoutSettingsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : carriers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No carriers found. Add carriers in the Carriers &amp; Products tab first.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Paid on Approval/Issue Column — uses submission_date */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Paid on Approval / Issue</h3>
                            <span className="text-xs text-muted-foreground">(Submission Date)</span>
                          </div>
                          <div className="space-y-2">
                            {carriers
                              .filter((c: Carrier) => carrierPayoutModes[c.id] === 'submission_date')
                              .sort((a: Carrier, b: Carrier) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
                              .map((carrier: Carrier) => (
                                <div
                                  key={carrier.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                                >
                                  <span className="text-sm font-medium text-foreground">{carrier.displayName || carrier.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCarrierPayoutModes(prev => ({ ...prev, [carrier.id]: 'policy_effective_date' }))}
                                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            {carriers.filter((c: Carrier) => carrierPayoutModes[c.id] === 'submission_date').length === 0 && (
                              <div className="text-center py-6 text-sm text-muted-foreground">No carriers assigned</div>
                            )}
                          </div>
                        </div>

                        {/* Paid on Draft Column — uses policy_effective_date */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">Paid on Draft</h3>
                            <span className="text-xs text-muted-foreground">(Policy Effective Date)</span>
                          </div>
                          <div className="space-y-2">
                            {carriers
                              .filter((c: Carrier) => carrierPayoutModes[c.id] === 'policy_effective_date' || !carrierPayoutModes[c.id])
                              .sort((a: Carrier, b: Carrier) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
                              .map((carrier: Carrier) => (
                                <div
                                  key={carrier.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCarrierPayoutModes(prev => ({ ...prev, [carrier.id]: 'submission_date' }))}
                                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                  >
                                    <ArrowLeft className="h-4 w-4" />
                                  </Button>
                                  <span className="text-sm font-medium text-foreground">{carrier.displayName || carrier.name}</span>
                                </div>
                              ))}
                            {carriers.filter((c: Carrier) => carrierPayoutModes[c.id] === 'policy_effective_date' || !carrierPayoutModes[c.id]).length === 0 && (
                              <div className="text-center py-6 text-sm text-muted-foreground">No carriers assigned</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-border">
                        <Button
                          onClick={handleSavePayoutSettings}
                          disabled={savingPayoutSettings}
                          className="min-w-[120px]"
                        >
                          {savingPayoutSettings ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Save Settings'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Scoreboard Tab */}
              {activeTab === "scoreboard" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-1">Scoreboard Settings</h2>
                    <p className="text-sm text-muted-foreground">
                      Configure scoreboard visibility settings for your agents
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Agent Scoreboard Visibility</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          When enabled, all agents can see the full agency scoreboard stats (production, policies, active agents). When disabled, non-admin agents only see stats when viewing their own team.
                        </p>
                      </div>
                      <Switch
                        checked={agencyData?.scoreboardAgentVisibility ?? false}
                        onCheckedChange={async (enabled) => {
                          if (!agencyData?.id) return
                          try {
                            await apiClient.patch(`/api/agencies/${agencyData.id}/settings/`, { scoreboardAgentVisibility: enabled })
                            queryClient.invalidateQueries({ queryKey: queryKeys.configurationAgency() })
                            showSuccess(`Scoreboard visibility ${enabled ? 'enabled' : 'disabled'} for all agents`)
                          } catch {
                            showError('Failed to update scoreboard visibility setting')
                          }
                        }}
                      />
                    </div>
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
                  Products for {carriers.find(c => c.id === selectedCarrier)?.displayName}
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
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                      <tr className="border-b-2 border-border bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                        <th className="text-left py-4 px-6 font-bold text-gray-800 dark:text-gray-200">Product Name</th>
                        <th className="text-left py-4 px-6 font-bold text-gray-800 dark:text-gray-200">Product Code</th>
                        <th className="text-left py-4 px-6 font-bold text-gray-800 dark:text-gray-200">Status</th>
                        <th className="text-right py-4 px-6 font-bold text-gray-800 dark:text-gray-200">Actions</th>
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
                          <tr key={product.id} className="border-b border-border hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
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
                                  value={editProductFormData.productCode}
                                  onChange={(e) => setEditProductFormData(prev => ({ ...prev, productCode: e.target.value }))}
                                  className="h-10 text-lg"
                                  placeholder="N/A"
                                />
                              ) : (
                                product.productCode || "N/A"
                              )}
                            </td>
                            <td className="py-5 px-6">
                              {editingProductId === product.id ? (
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    checked={editProductFormData.isActive}
                                    onCheckedChange={(checked) => setEditProductFormData(prev => ({ ...prev, isActive: checked as boolean }))}
                                  />
                                  <span className="text-lg text-muted-foreground font-medium">
                                    {editProductFormData.isActive ? "Active" : "Inactive"}
                                  </span>
                                </div>
                              ) : (
                                <span className={`px-3 py-2 rounded-full text-sm font-bold ${
                                  product.isActive
                                    ? "bg-green-100 text-green-800 border border-green-300"
                                    : "bg-red-100 text-red-800 border border-red-300"
                                }`}>
                                  {product.isActive ? "Active" : "Inactive"}
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
              <DialogDescription>
                Are you sure you want to delete the product "{productToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
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
              <DialogDescription>
                Are you sure you want to delete the position "{positionToDelete?.name}"? This action cannot be undone. You cannot delete a position that is currently assigned to agents.
              </DialogDescription>
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
      </main>
    </div>
  )
}
