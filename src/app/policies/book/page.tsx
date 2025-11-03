"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { AsyncSearchableSelect } from "@/components/ui/async-searchable-select"
import { Loader2, Filter, X } from "lucide-react"
import { PolicyDetailsModal } from "@/components/modals/policy-details-modal"

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
  effectiveDate: string
  annualPremium: string
  leadSource: string
  billingCycle: string
  status: string
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
  // Local filter state (what user selects but hasn't applied yet)
  const [localAgent, setLocalAgent] = useState("all")
  const [localCarrier, setLocalCarrier] = useState("all")
  const [localProduct, setLocalProduct] = useState("all")
  const [localClient, setLocalClient] = useState("all")
  const [localPolicyNumber, setLocalPolicyNumber] = useState("all")
  const [localStatus, setLocalStatus] = useState("all")
  const [localBillingCycle, setLocalBillingCycle] = useState("all")
  const [localLeadSource, setLocalLeadSource] = useState("all")
  const [localEffectiveDateStart, setLocalEffectiveDateStart] = useState("")
  const [localEffectiveDateEnd, setLocalEffectiveDateEnd] = useState("")

  // Active filter state (what's actually applied)
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedCarrier, setSelectedCarrier] = useState("all")
  const [selectedProduct, setSelectedProduct] = useState("all")
  const [selectedClient, setSelectedClient] = useState("all")
  const [selectedPolicyNumber, setSelectedPolicyNumber] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedBillingCycle, setSelectedBillingCycle] = useState("all")
  const [selectedLeadSource, setSelectedLeadSource] = useState("all")
  const [selectedEffectiveDateStart, setSelectedEffectiveDateStart] = useState("")
  const [selectedEffectiveDateEnd, setSelectedEffectiveDateEnd] = useState("")

  // Modal state
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // State for API data
  const [deals, setDeals] = useState<Deal[]>([])
  const [nextCursor, setNextCursor] = useState<{ cursor_created_at: string; cursor_id: string } | null>(null)
  const nextCursorRef = useRef<{ cursor_created_at: string; cursor_id: string } | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    carriers: [{ value: "all", label: "All Carriers" }],
    products: [{ value: "all", label: "All Products" }],
    statuses: [{ value: "all", label: "All Statuses" }],
    billingCycles: [{ value: "all", label: "All Billing Cycles" }],
    leadSources: [{ value: "all", label: "All Lead Sources" }]
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch filter options on component mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await fetch('/api/deals/filter-options')
        if (!response.ok) {
          throw new Error('Failed to fetch filter options')
        }
        const data = await response.json()

        // Ensure all required fields exist
        setFilterOptions({
          carriers: data.carriers || [{ value: "all", label: "All Carriers" }],
          products: data.products || [{ value: "all", label: "All Products" }],
          statuses: data.statuses || [{ value: "all", label: "All Statuses" }],
          billingCycles: data.billingCycles || [{ value: "all", label: "All Billing Cycles" }],
          leadSources: data.leadSources || [{ value: "all", label: "All Lead Sources" }]
        })
      } catch (err) {
        console.error('Error fetching filter options:', err)
        setError('Failed to load filter options')
      }
    }

    fetchFilterOptions()
  }, [])

  // Update ref when nextCursor changes
  useEffect(() => {
    nextCursorRef.current = nextCursor
  }, [nextCursor])

  // Fetch deals data
  const fetchDeals = useCallback(async (reset: boolean = true) => {
    if (reset) setLoading(true)
    else setIsLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (selectedAgent !== 'all') params.append('agent_id', selectedAgent)
      if (selectedCarrier !== 'all') params.append('carrier_id', selectedCarrier)
      if (selectedProduct !== 'all') params.append('product_id', selectedProduct)
      if (selectedClient !== 'all') params.append('client_id', selectedClient)
      if (selectedPolicyNumber !== 'all') params.append('policy_number', selectedPolicyNumber)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      if (selectedBillingCycle !== 'all') params.append('billing_cycle', selectedBillingCycle)
      if (selectedLeadSource !== 'all') params.append('lead_source', selectedLeadSource)
      if (selectedEffectiveDateStart) params.append('effective_date_start', selectedEffectiveDateStart)
      if (selectedEffectiveDateEnd) params.append('effective_date_end', selectedEffectiveDateEnd)
      params.append('limit', '50')
      if (!reset && nextCursorRef.current) {
        params.append('cursor_created_at', nextCursorRef.current.cursor_created_at)
        params.append('cursor_id', nextCursorRef.current.cursor_id)
      }

      const response = await fetch(`/api/deals/book-of-business?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch deals')
      }
      const data = await response.json()
      if (reset) {
        setDeals(data.deals)
      } else {
        setDeals(prev => [...prev, ...data.deals])
      }
      setNextCursor(data.nextCursor || null)
      setError(null)
    } catch (err) {
      console.error('Error fetching deals:', err)
      setError('Failed to load deals data')
    } finally {
      if (reset) setLoading(false)
      else setIsLoadingMore(false)
    }
  }, [selectedAgent, selectedCarrier, selectedProduct, selectedClient, selectedPolicyNumber, selectedStatus, selectedBillingCycle, selectedLeadSource, selectedEffectiveDateStart, selectedEffectiveDateEnd])

  // Fetch deals when active filters change
  useEffect(() => {
    setNextCursor(null)
    fetchDeals(true)
  }, [fetchDeals])

  // Apply filters when button is clicked
  const handleApplyFilters = () => {
    setSelectedAgent(localAgent)
    setSelectedCarrier(localCarrier)
    setSelectedProduct(localProduct)
    setSelectedClient(localClient)
    setSelectedPolicyNumber(localPolicyNumber)
    setSelectedStatus(localStatus)
    setSelectedBillingCycle(localBillingCycle)
    setSelectedLeadSource(localLeadSource)
    setSelectedEffectiveDateStart(localEffectiveDateStart)
    setSelectedEffectiveDateEnd(localEffectiveDateEnd)
  }

  // Clear all filters
  const handleClearFilters = () => {
    setLocalAgent("all")
    setLocalCarrier("all")
    setLocalProduct("all")
    setLocalClient("all")
    setLocalPolicyNumber("all")
    setLocalStatus("all")
    setLocalBillingCycle("all")
    setLocalLeadSource("all")
    setLocalEffectiveDateStart("")
    setLocalEffectiveDateEnd("")
    setSelectedAgent("all")
    setSelectedCarrier("all")
    setSelectedProduct("all")
    setSelectedClient("all")
    setSelectedPolicyNumber("all")
    setSelectedStatus("all")
    setSelectedBillingCycle("all")
    setSelectedLeadSource("all")
    setSelectedEffectiveDateStart("")
    setSelectedEffectiveDateEnd("")
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
    // Refresh the deals list after update
    fetchDeals(true)
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

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gradient">Book of Business</h1>
        <div className="flex gap-2 items-center">
          <Button
            onClick={handleApplyFilters}
            size="sm"
            className="btn-gradient h-8 px-4"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filter
          </Button>
          {(selectedAgent !== 'all' || selectedCarrier !== 'all' || selectedProduct !== 'all' || selectedClient !== 'all' || selectedPolicyNumber !== 'all' || selectedStatus !== 'all' || selectedBillingCycle !== 'all' || selectedLeadSource !== 'all' || selectedEffectiveDateStart || selectedEffectiveDateEnd) && (
            <Button
              onClick={handleClearFilters}
              variant="outline"
              size="sm"
              className="h-8 px-3"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-destructive/20 border border-destructive/30 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="professional-card filter-container !rounded-md">
        <CardContent className="p-2">
          <div className="space-y-2">
            {/* First Row - 5 filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Agent */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Agent
                </label>
                <AsyncSearchableSelect
                  value={localAgent}
                  onValueChange={setLocalAgent}
                  placeholder="All Agents"
                  searchPlaceholder="Type to search agents..."
                  searchEndpoint="/api/deals/search-agents"
                />
              </div>

              {/* Carrier */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Carrier
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.carriers}
                  value={localCarrier}
                  onValueChange={setLocalCarrier}
                  placeholder="All Carriers"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Product */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Product
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.products}
                  value={localProduct}
                  onValueChange={setLocalProduct}
                  placeholder="All Products"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Client
                </label>
                <AsyncSearchableSelect
                  value={localClient}
                  onValueChange={setLocalClient}
                  placeholder="All Clients"
                  searchPlaceholder="Type to search clients..."
                  searchEndpoint="/api/deals/search-clients"
                />
              </div>

              {/* Policy Number */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Policy #
                </label>
                <AsyncSearchableSelect
                  value={localPolicyNumber}
                  onValueChange={setLocalPolicyNumber}
                  placeholder="All Policy Numbers"
                  searchPlaceholder="Type to search policy numbers..."
                  searchEndpoint="/api/deals/search-policy-numbers"
                />
              </div>
            </div>

            {/* Second Row - 5 filters + buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 items-end">
              {/* Status */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Status
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.statuses}
                  value={localStatus}
                  onValueChange={setLocalStatus}
                  placeholder="All Statuses"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Billing Cycle
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.billingCycles}
                  value={localBillingCycle}
                  onValueChange={setLocalBillingCycle}
                  placeholder="All Billing Cycles"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Lead Source */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Lead Source
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.leadSources}
                  value={localLeadSource}
                  onValueChange={setLocalLeadSource}
                  placeholder="All Lead Sources"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Effective Date Start */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Effective Date Start
                </label>
                <Input
                  type="date"
                  value={localEffectiveDateStart}
                  onChange={(e) => setLocalEffectiveDateStart(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Effective Date End */}
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Effective Date End
                </label>
                <Input
                  type="date"
                  value={localEffectiveDateEnd}
                  onChange={(e) => setLocalEffectiveDateEnd(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies Table */}
      <div className="table-container">
        <div className="table-wrapper custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading deals...</span>
            </div>
          ) : (
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
                {deals.length === 0 ? (
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
                            {deal.clientPhone && (
                              <span className="text-xs text-muted-foreground">{formatPhoneNumber(deal.clientPhone)}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className="text-primary font-bold text-base">{deal.annualPremium}</span>
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
                            className={`${getStatusColor(deal.status)} border capitalize`}
                            variant="outline"
                          >
                            {deal.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
          )}
        </div>
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

      {/* Policy Details Modal */}
      {selectedDealId && (
        <PolicyDetailsModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          dealId={selectedDealId}
          onUpdate={handlePolicyUpdate}
        />
      )}
    </div>
  )
}