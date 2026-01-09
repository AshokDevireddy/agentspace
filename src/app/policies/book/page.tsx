"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { AsyncSearchableSelect } from "@/components/ui/async-searchable-select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Loader2, Plus, X } from "lucide-react"
import { PolicyDetailsModal } from "@/components/modals/policy-details-modal"
import { usePersistedFilters } from "@/hooks/usePersistedFilters"
import { cn } from "@/lib/utils"
import { RefreshingIndicator } from "@/components/ui/refreshing-indicator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { createClient } from "@/lib/supabase/client"
import { useApiFetch } from "@/hooks/useApiFetch"
import { queryKeys } from "@/hooks/queryKeys"
import { useQuery, useQueryClient } from "@tanstack/react-query"

// Types for the API responses
interface Deal {
  id: string
  carrierId: string
  date: string
  agent: string
  carrier: string
  product: string
  policyNumber: string
  appNumber: string
  clientName: string
  clientPhone: string
  phoneHidden?: boolean
  agentId?: string
  effectiveDate: string
  annualPremium: string
  leadSource: string
  billingCycle: string
  status: string
  statusStandardized: string
}

interface EditableDeal extends Deal {
  originalData?: Deal // Store original data for cancel functionality
}

interface FilterOption {
  value: string
  label: string
}

interface FilterOptions {
  carriers: FilterOption[]
  products: FilterOption[]
  statuses: FilterOption[]
  billingCycles: FilterOption[]
  leadSources: FilterOption[]
  effectiveDateSort: FilterOption[]
}

// Dynamic color generator for status values - MORE VIBRANT
const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('draft')) return "bg-gray-600 text-white border-gray-700";
  if (statusLower.includes('pending') || statusLower.includes('force')) return "bg-yellow-500 text-gray-900 border-yellow-600 font-semibold";
  if (statusLower.includes('verified') || statusLower.includes('approve')) return "bg-green-600 text-white border-green-700";
  if (statusLower.includes('active') || statusLower.includes('issued')) return "bg-blue-600 text-white border-blue-700";
  if (statusLower.includes('terminated') || statusLower.includes('lapsed') || statusLower.includes('cancel')) return "bg-red-600 text-white border-red-700";
  if (statusLower.includes('submit')) return "bg-purple-600 text-white border-purple-700";
  if (statusLower.includes('paid')) return "bg-emerald-600 text-white border-emerald-700";
  if (statusLower.includes('decline') || statusLower.includes('closed')) return "bg-slate-600 text-white border-slate-700";
  return "bg-slate-500 text-white border-slate-600";
}

const leadSourceColors: Record<string, string> = {
  "referral": "bg-emerald-600 text-white border-emerald-700",
  "provided": "bg-blue-600 text-white border-blue-700",
  "purchased": "bg-purple-600 text-white border-purple-700",
  "no_lead": "bg-gray-600 text-white border-gray-700",
  "cold call": "bg-cyan-600 text-white border-cyan-700",
  "walk-in": "bg-orange-600 text-white border-orange-700",
  "facebook": "bg-indigo-600 text-white border-indigo-700",
  "online lead": "bg-pink-600 text-white border-pink-700",
}

const billingCycleColors: Record<string, string> = {
  "monthly": "bg-blue-600 text-white border-blue-700",
  "quarterly": "bg-green-600 text-white border-green-700",
  "semi-annually": "bg-orange-600 text-white border-orange-700",
  "annually": "bg-purple-600 text-white border-purple-700",
}

export default function BookOfBusiness() {
  // Persisted filter state using custom hook
  const { localFilters, appliedFilters, setLocalFilters, applyFilters, clearFilters, setAndApply } = usePersistedFilters(
    'book-of-business',
    {
      agent: "all",
      carrier: "all",
      product: "all",
      client: "all",
      policyNumber: "all",
      billingCycle: "all",
      leadSource: "all",
      status: "all",
      effectiveDateSort: "all",
      effectiveDateStart: "",
      effectiveDateEnd: "",
      statusMode: 'all' as 'all' | 'active' | 'pending' | 'inactive',
      viewMode: 'downlines' as 'downlines' | 'self'
    },
    ['statusMode', 'viewMode'] // Preserve statusMode and viewMode when clearing filters
  )

  // Use persisted status mode - setAndApply updates immediately
  const statusMode = appliedFilters.statusMode
  const setStatusMode = (value: 'all' | 'active' | 'pending' | 'inactive') => {
    setAndApply({ statusMode: value })
  }

  // Use persisted view mode - setAndApply updates immediately
  const viewMode = appliedFilters.viewMode
  const setViewMode = (value: 'downlines' | 'self') => {
    setAndApply({ viewMode: value })
  }

  // Track which filters are visible (showing input fields) - load from localStorage
  const [visibleFilters, setVisibleFilters] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('book-of-business-visible-filters')
      if (stored) {
        try {
          return new Set(JSON.parse(stored))
        } catch {
          return new Set()
        }
      }
    }
    return new Set()
  })

  // Track if the add filter menu is open
  const [addFilterMenuOpen, setAddFilterMenuOpen] = useState(false)

  // Persist visible filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('book-of-business-visible-filters', JSON.stringify(Array.from(visibleFilters)))
    }
  }, [visibleFilters])

  const queryClient = useQueryClient()

  // Modal state
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // State for load-more pagination
  const [deals, setDeals] = useState<Deal[]>([])
  const [nextCursor, setNextCursor] = useState<{ cursor_created_at: string; cursor_id: string } | null>(null)
  const nextCursorRef = useRef<{ cursor_created_at: string; cursor_id: string } | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Update ref when nextCursor changes
  useEffect(() => {
    nextCursorRef.current = nextCursor
  }, [nextCursor])

  // Fetch user subscription tier using TanStack Query
  const { data: userTier = 'free' } = useQuery({
    queryKey: queryKeys.userProfile(),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('auth_user_id', user.id)
          .single()

        return userData?.subscription_tier || 'free'
      }
      return 'free'
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch filter options using parallel queries
  const { data: filterOptionsData } = useApiFetch<{
    carriers?: FilterOption[]
    products?: FilterOption[]
    statusStandardized?: FilterOption[]
    billingCycles?: FilterOption[]
    leadSources?: FilterOption[]
    effectiveDateSort?: FilterOption[]
  }>(
    queryKeys.dealsFilterOptions(),
    '/api/deals/filter-options',
    {
      staleTime: 15 * 60 * 1000, // 15 minutes - filter options rarely change
      placeholderData: (previousData) => previousData, // Stale-while-revalidate
    }
  )

  const { data: niprCarriers } = useApiFetch<Array<{ id: string; display_name: string }>>(
    queryKeys.carriersList('nipr'),
    '/api/carriers?filter=nipr',
    {
      staleTime: 15 * 60 * 1000, // 15 minutes - carrier list rarely changes
      placeholderData: (previousData) => previousData, // Stale-while-revalidate
    }
  )

  // Compute filter options
  const filterOptions: FilterOptions = {
    carriers: niprCarriers && niprCarriers.length > 0
      ? [
          { value: "all", label: "All Carriers" },
          ...niprCarriers.map((c) => ({
            value: c.id,
            label: c.display_name
          }))
        ]
      : filterOptionsData?.carriers || [{ value: "all", label: "All Carriers" }],
    products: filterOptionsData?.products || [{ value: "all", label: "All Products" }],
    statuses: filterOptionsData?.statusStandardized || [],
    billingCycles: filterOptionsData?.billingCycles || [{ value: "all", label: "All Billing Cycles" }],
    leadSources: filterOptionsData?.leadSources || [{ value: "all", label: "All Lead Sources" }],
    effectiveDateSort: filterOptionsData?.effectiveDateSort || []
  }

  // Build query params for deals API
  const buildDealsParams = useCallback((cursor?: { cursor_created_at: string; cursor_id: string }) => {
    const params = new URLSearchParams()
    if (appliedFilters.agent !== 'all') params.append('agent_id', appliedFilters.agent)
    if (appliedFilters.carrier !== 'all') params.append('carrier_id', appliedFilters.carrier)
    if (appliedFilters.product !== 'all') params.append('product_id', appliedFilters.product)
    if (appliedFilters.client !== 'all') params.append('client_id', appliedFilters.client)
    if (appliedFilters.policyNumber !== 'all') params.append('policy_number', appliedFilters.policyNumber)
    if (appliedFilters.statusMode && appliedFilters.statusMode !== 'all') params.append('status_mode', appliedFilters.statusMode)
    if (appliedFilters.billingCycle !== 'all') params.append('billing_cycle', appliedFilters.billingCycle)
    if (appliedFilters.leadSource !== 'all') params.append('lead_source', appliedFilters.leadSource)
    if (appliedFilters.status !== 'all') params.append('status_standardized', appliedFilters.status)
    if (appliedFilters.effectiveDateSort !== 'all') params.append('effective_date_sort', appliedFilters.effectiveDateSort)
    if (appliedFilters.effectiveDateStart) params.append('effective_date_start', appliedFilters.effectiveDateStart)
    if (appliedFilters.effectiveDateEnd) params.append('effective_date_end', appliedFilters.effectiveDateEnd)
    if (appliedFilters.viewMode) params.append('view', appliedFilters.viewMode)
    params.append('limit', '50')
    if (cursor) {
      params.append('cursor_created_at', cursor.cursor_created_at)
      params.append('cursor_id', cursor.cursor_id)
    }
    return params.toString()
  }, [appliedFilters])

  // Fetch deals using TanStack Query
  const { data: dealsData, isLoading: loading, isFetching: dealsFetching, error: dealsError } = useQuery({
    queryKey: queryKeys.dealsBookOfBusiness(appliedFilters),
    queryFn: async () => {
      const params = buildDealsParams()
      const response = await fetch(`/api/deals/book-of-business?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch deals')
      }
      return response.json() as Promise<{ deals: Deal[]; nextCursor?: { cursor_created_at: string; cursor_id: string } }>
    },
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data during refetch to prevent flicker
  })

  const isRefreshing = dealsFetching && !loading // Background refetch with stale data shown

  // Update deals and cursor when data changes
  useEffect(() => {
    if (dealsData) {
      setDeals(dealsData.deals)
      setNextCursor(dealsData.nextCursor || null)
    }
  }, [dealsData])

  // Load more deals function
  const fetchDeals = useCallback(async (reset: boolean = true) => {
    if (reset) {
      // Reset is handled by the query above
      return
    }

    // Load more
    setIsLoadingMore(true)
    try {
      const params = buildDealsParams(nextCursorRef.current || undefined)
      const response = await fetch(`/api/deals/book-of-business?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch deals')
      }
      const data = await response.json()
      setDeals(prev => [...prev, ...data.deals])
      setNextCursor(data.nextCursor || null)
    } catch (err) {
      console.error('Error fetching more deals:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [buildDealsParams])

  const error = dealsError ? 'Failed to load deals data' : null

  // Apply filters when button is clicked
  const handleApplyFilters = () => {
    applyFilters()
  }

  // Clear all filters
  const handleClearFilters = () => {
    clearFilters()
    // Also hide all filter input fields
    setVisibleFilters(new Set())
  }

  const handleRowClick = (deal: Deal) => {
    setSelectedDealId(deal.id)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedDealId(null)
  }

  const handlePolicyUpdate = () => {
    // Refresh the deals list after update by invalidating the query
    // Use partial key to match any book-of-business query regardless of filters
    queryClient.invalidateQueries({ queryKey: queryKeys.dealsBookOfBusiness() })
  }

  const getLeadSourceColor = (leadSource: string) => {
    const normalized = leadSource.toLowerCase().trim();
    return leadSourceColors[normalized] || "bg-slate-500 text-white border-slate-600";
  }

  const getBillingCycleColor = (cycle: string) => {
    const normalized = cycle.toLowerCase().trim();
    return billingCycleColors[normalized] || "bg-slate-500 text-white border-slate-600";
  }

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Check if we have a valid 10-digit phone number
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // If it's 11 digits and starts with 1, remove the 1 and format
    if (digits.length === 11 && digits[0] === '1') {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    // Return original if it doesn't match expected format
    return phone;
  }

  const hasActiveFilters =
    appliedFilters.agent !== 'all' ||
    appliedFilters.carrier !== 'all' ||
    appliedFilters.product !== 'all' ||
    appliedFilters.client !== 'all' ||
    appliedFilters.policyNumber !== 'all' ||
    appliedFilters.billingCycle !== 'all' ||
    appliedFilters.leadSource !== 'all' ||
    appliedFilters.status !== 'all' ||
    appliedFilters.effectiveDateSort !== 'all' ||
    appliedFilters.effectiveDateStart ||
    appliedFilters.effectiveDateEnd

  const addFilter = (filterName: string) => {
    const newVisibleFilters = new Set(visibleFilters)
    newVisibleFilters.add(filterName)
    setVisibleFilters(newVisibleFilters)
    setAddFilterMenuOpen(false)
  }

  const removeFilter = (filterName: string) => {
    const newVisibleFilters = new Set(visibleFilters)
    newVisibleFilters.delete(filterName)
    setVisibleFilters(newVisibleFilters)

    // Reset the filter value when removing
    switch(filterName) {
      case 'agent':
        setLocalFilters({ agent: 'all' })
        break
      case 'carrier':
        setLocalFilters({ carrier: 'all' })
        break
      case 'product':
        setLocalFilters({ product: 'all' })
        break
      case 'client':
        setLocalFilters({ client: 'all' })
        break
      case 'policyNumber':
        setLocalFilters({ policyNumber: 'all' })
        break
      case 'billingCycle':
        setLocalFilters({ billingCycle: 'all' })
        break
      case 'leadSource':
        setLocalFilters({ leadSource: 'all' })
        break
      case 'status':
        setLocalFilters({ status: 'all' })
        break
      case 'effectiveDateSort':
        setLocalFilters({ effectiveDateSort: 'all' })
        break
      case 'dateRange':
        setLocalFilters({ effectiveDateStart: '', effectiveDateEnd: '' })
        break
      case 'persistencyPlacement':
        setStatusMode('all')
        break
    }
  }

  const availableFilters = [
    { id: 'agent', label: 'Agent' },
    { id: 'carrier', label: 'Carrier' },
    { id: 'product', label: 'Product' },
    { id: 'client', label: 'Client' },
    { id: 'policyNumber', label: 'Policy #' },
    { id: 'billingCycle', label: 'Billing Cycle' },
    { id: 'leadSource', label: 'Lead Source' },
    { id: 'status', label: 'Status' },
    { id: 'effectiveDateSort', label: 'Oldest/Newest' },
    { id: 'dateRange', label: 'Date Range' },
    { id: 'persistencyPlacement', label: 'Persistency/Placement' },
  ]

  return (
    <div className="space-y-6 max-w-full overflow-hidden relative book-content" data-tour="book">
      {/* Upgrade prompt overlay for Basic tier viewing downlines */}
      {userTier === 'basic' && viewMode === 'downlines' && (
        <div className="fixed z-40 pointer-events-none" style={{ top: '3rem', left: '16rem', right: 0, bottom: 0 }}>
          <div className="h-full flex items-center justify-center pointer-events-auto">
            <UpgradePrompt
              title="Upgrade to View Downline Data"
              message="Upgrade to Pro or Expert tier to view and manage your team's deals"
              requiredTier="Pro"
              blur={false}
            />
          </div>
        </div>
      )}

      {/* Header with Status Slider and View Mode Slider - Always interactive */}
      <div className="flex items-center justify-between relative z-50">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold text-foreground">Book of Business</h1>
          <RefreshingIndicator isRefreshing={isRefreshing} />
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Slider */}
          <div className="relative bg-muted/50 p-1 rounded-lg">
            {/* Animated background */}
            <div
              className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out"
              style={{
                left: viewMode === 'self' ? '4px' : 'calc(50%)',
                width: 'calc(50% - 4px)'
              }}
            />
            <div className="relative z-10 flex">
              <button
                onClick={() => setViewMode('self')}
                disabled={loading}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center",
                  viewMode === 'self'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                Just Me
              </button>
              <button
                onClick={() => setViewMode('downlines')}
                disabled={loading}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center",
                  viewMode === 'downlines'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                Downlines
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-destructive/20 border border-destructive/30 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Filter Controls - Always interactive */}
      <Card className="professional-card !rounded-md relative z-50">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Add Filter Button and Active Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={addFilterMenuOpen} onOpenChange={setAddFilterMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Filter
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {availableFilters.map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => addFilter(filter.id)}
                        disabled={visibleFilters.has(filter.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                          visibleFilters.has(filter.id)
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Filter chips for visible filters */}
              {visibleFilters.has('agent') && (
                <Badge variant="outline" className="h-8 px-3">
                  Agent
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('agent')}
                  />
                </Badge>
              )}
              {visibleFilters.has('carrier') && (
                <Badge variant="outline" className="h-8 px-3">
                  Carrier
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('carrier')}
                  />
                </Badge>
              )}
              {visibleFilters.has('product') && (
                <Badge variant="outline" className="h-8 px-3">
                  Product
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('product')}
                  />
                </Badge>
              )}
              {visibleFilters.has('client') && (
                <Badge variant="outline" className="h-8 px-3">
                  Client
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('client')}
                  />
                </Badge>
              )}
              {visibleFilters.has('policyNumber') && (
                <Badge variant="outline" className="h-8 px-3">
                  Policy #
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('policyNumber')}
                  />
                </Badge>
              )}
              {visibleFilters.has('billingCycle') && (
                <Badge variant="outline" className="h-8 px-3">
                  Billing Cycle
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('billingCycle')}
                  />
                </Badge>
              )}
              {visibleFilters.has('leadSource') && (
                <Badge variant="outline" className="h-8 px-3">
                  Lead Source
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('leadSource')}
                  />
                </Badge>
              )}
              {visibleFilters.has('status') && (
                <Badge variant="outline" className="h-8 px-3">
                  Status
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('status')}
                  />
                </Badge>
              )}
              {visibleFilters.has('effectiveDateSort') && (
                <Badge variant="outline" className="h-8 px-3">
                  Oldest/Newest
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('effectiveDateSort')}
                  />
                </Badge>
              )}
              {visibleFilters.has('dateRange') && (
                <Badge variant="outline" className="h-8 px-3">
                  Date Range
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('dateRange')}
                  />
                </Badge>
              )}
              {visibleFilters.has('persistencyPlacement') && (
                <Badge variant="outline" className="h-8 px-3">
                  Persistency/Placement
                  <X
                    className="h-3 w-3 ml-2 cursor-pointer"
                    onClick={() => removeFilter('persistencyPlacement')}
                  />
                </Badge>
              )}

              {hasActiveFilters && (
                <Button
                  onClick={handleClearFilters}
                  variant="ghost"
                  size="sm"
                  className="h-8"
                >
                  Clear All
                </Button>
              )}

              <div className="ml-auto">
                <Button
                  onClick={handleApplyFilters}
                  size="sm"
                  className="bg-foreground hover:bg-foreground/90 text-background h-8 px-4"
                  disabled={loading}
                >
                  Apply Filters
                </Button>
              </div>
            </div>

            {/* Collapsible Filter Fields */}
            {visibleFilters.size > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleFilters.has('agent') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Agent
                    </label>
                    <AsyncSearchableSelect
                      value={localFilters.agent}
                      onValueChange={(value) => setLocalFilters({ agent: value })}
                      placeholder="All Agents"
                      searchPlaceholder="Type to search agents..."
                      searchEndpoint="/api/deals/search-agents"
                    />
                  </div>
                )}

                {visibleFilters.has('carrier') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Carrier
                    </label>
                    <SimpleSearchableSelect
                      options={filterOptions.carriers}
                      value={localFilters.carrier}
                      onValueChange={(value) => setLocalFilters({ carrier: value })}
                      placeholder="All Carriers"
                      searchPlaceholder="Search..."
                    />
                  </div>
                )}

                {visibleFilters.has('product') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Product
                    </label>
                    <SimpleSearchableSelect
                      options={filterOptions.products}
                      value={localFilters.product}
                      onValueChange={(value) => setLocalFilters({ product: value })}
                      placeholder="All Products"
                      searchPlaceholder="Search..."
                    />
                  </div>
                )}

                {visibleFilters.has('client') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Client
                    </label>
                    <AsyncSearchableSelect
                      value={localFilters.client}
                      onValueChange={(value) => setLocalFilters({ client: value })}
                      placeholder="All Clients"
                      searchPlaceholder="Type to search clients..."
                      searchEndpoint="/api/deals/search-clients"
                    />
                  </div>
                )}

                {visibleFilters.has('policyNumber') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Policy #
                    </label>
                    <AsyncSearchableSelect
                      value={localFilters.policyNumber}
                      onValueChange={(value) => setLocalFilters({ policyNumber: value })}
                      placeholder="All Policy Numbers"
                      searchPlaceholder="Type to search policy numbers..."
                      searchEndpoint="/api/deals/search-policy-numbers"
                    />
                  </div>
                )}

                {visibleFilters.has('billingCycle') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Billing Cycle
                    </label>
                    <SimpleSearchableSelect
                      options={filterOptions.billingCycles}
                      value={localFilters.billingCycle}
                      onValueChange={(value) => setLocalFilters({ billingCycle: value })}
                      placeholder="All Billing Cycles"
                      searchPlaceholder="Search..."
                    />
                  </div>
                )}

                {visibleFilters.has('leadSource') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Lead Source
                    </label>
                    <SimpleSearchableSelect
                      options={filterOptions.leadSources}
                      value={localFilters.leadSource}
                      onValueChange={(value) => setLocalFilters({ leadSource: value })}
                      placeholder="All Lead Sources"
                      searchPlaceholder="Search..."
                    />
                  </div>
                )}

                {visibleFilters.has('status') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Status
                    </label>
                    <SimpleSearchableSelect
                      options={filterOptions.statuses}
                      value={localFilters.status}
                      onValueChange={(value) => setLocalFilters({ status: value })}
                      placeholder="All Statuses"
                      searchPlaceholder="Search..."
                    />
                  </div>
                )}

                {visibleFilters.has('effectiveDateSort') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Oldest/Newest
                    </label>
                    <SimpleSearchableSelect
                      options={filterOptions.effectiveDateSort || []}
                      value={localFilters.effectiveDateSort}
                      onValueChange={(value) => setLocalFilters({ effectiveDateSort: value })}
                      placeholder="Select sort order..."
                      searchPlaceholder="Search..."
                    />
                  </div>
                )}

                {visibleFilters.has('dateRange') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Effective Date Range
                    </label>
                    <DateRangePicker
                      startDate={localFilters.effectiveDateStart}
                      endDate={localFilters.effectiveDateEnd}
                      onRangeChange={(start, end) => setLocalFilters({ effectiveDateStart: start, effectiveDateEnd: end })}
                      disabled={loading}
                    />
                  </div>
                )}

                {visibleFilters.has('persistencyPlacement') && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Persistency/Placement
                    </label>
                    <SimpleSearchableSelect
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'active', label: 'Active' },
                        { value: 'pending', label: 'Not Placed' },
                        { value: 'inactive', label: 'Inactive' }
                      ]}
                      value={statusMode}
                      onValueChange={(value) => setStatusMode(value as 'all' | 'active' | 'pending' | 'inactive')}
                      placeholder="Select status..."
                      searchPlaceholder="Search..."
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Policies Table */}
      <div className={cn(
        "table-container",
        userTier === 'basic' && viewMode === 'downlines' && "blur-sm pointer-events-none"
      )}>
        <div className="table-wrapper custom-scrollbar">
          <table className="jira-table min-w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Agent</th>
                <th>Carrier / Product</th>
                <th>Policy / App #</th>
                <th>Client Info</th>
                <th>Premium / Effective Date</th>
                <th>Lead Source</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton loaders for table rows
                Array.from({ length: 10 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td><div className="h-4 w-20 bg-muted rounded" /></td>
                    <td><div className="h-4 w-24 bg-muted rounded" /></td>
                    <td>
                      <div className="space-y-1">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted rounded" />
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="h-4 w-28 bg-muted rounded" />
                        <div className="h-3 w-20 bg-muted rounded" />
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted rounded" />
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="h-5 w-24 bg-muted rounded" />
                        <div className="h-3 w-28 bg-muted rounded" />
                        <div className="h-5 w-20 bg-muted rounded" />
                      </div>
                    </td>
                    <td><div className="h-6 w-24 bg-muted rounded" /></td>
                    <td className="text-center"><div className="h-6 w-20 bg-muted rounded mx-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-destructive">
                    Error: {error}
                  </td>
                </tr>
              ) : deals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No deals found matching your criteria
                  </td>
                </tr>
              ) : (
                deals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleRowClick(deal)}
                    >
                        <td className="whitespace-nowrap">{deal.date}</td>
                        <td className="whitespace-nowrap">{deal.agent}</td>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">{deal.carrier}</span>
                            <span className="text-xs text-muted-foreground">{deal.product}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            {deal.policyNumber ? (
                              <span className="text-sm font-medium">{deal.policyNumber}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No Policy #</span>
                            )}
                            {deal.appNumber && (
                              <span className="text-xs text-muted-foreground">App: {deal.appNumber}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{deal.clientName}</span>
                            {deal.phoneHidden ? (
                              <Badge
                                className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs w-fit"
                                variant="outline"
                              >
                                Hidden
                              </Badge>
                            ) : deal.clientPhone ? (
                              <span className="text-xs text-muted-foreground">{formatPhoneNumber(deal.clientPhone)}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className="text-foreground font-bold text-base">{deal.annualPremium}</span>
                            <span className="text-xs text-muted-foreground">{deal.effectiveDate}</span>
                            {deal.billingCycle ? (
                              <Badge
                                className={`${getBillingCycleColor(deal.billingCycle)} border capitalize text-xs w-fit`}
                                variant="outline"
                              >
                                {deal.billingCycle}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {deal.leadSource ? (
                            <Badge
                              className={`${getLeadSourceColor(deal.leadSource)} border capitalize`}
                              variant="outline"
                            >
                              {deal.leadSource}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </td>
                        <td className="text-center">
                          <Badge
                            className={`${getStatusColor(deal.statusStandardized)} border capitalize`}
                            variant="outline"
                          >
                            {deal.statusStandardized}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
        </div>
        {!loading && deals.length > 0 ? (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              disabled={!nextCursor || isLoadingMore}
              onClick={() => fetchDeals(false)}
            >
              {isLoadingMore ? (
                <span className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                </span>
              ) : (
                <span>{nextCursor ? 'Load more' : 'No more results'}</span>
              )}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Policy Details Modal */}
      {selectedDealId && (
        <PolicyDetailsModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          dealId={selectedDealId}
          onUpdate={handlePolicyUpdate}
          viewMode={viewMode}
        />
      )}
    </div>
  )
}