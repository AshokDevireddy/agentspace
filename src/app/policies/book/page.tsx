"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Loader2 } from "lucide-react"
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
  agents: FilterOption[]
  carriers: FilterOption[]
  policyNumbers: FilterOption[]
  statuses: FilterOption[]
  leadSources: FilterOption[]
  hasAlertOptions: FilterOption[]
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
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedCarrier, setSelectedCarrier] = useState("all")
  const [policyNumberSearch, setPolicyNumberSearch] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedLeadSource, setSelectedLeadSource] = useState("all")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedHasAlert, setSelectedHasAlert] = useState("all")

  // Modal state
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // State for API data
  const [deals, setDeals] = useState<Deal[]>([])
  const [nextCursor, setNextCursor] = useState<{ cursor_created_at: string; cursor_id: string } | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    agents: [{ value: "all", label: "Select an Agent" }],
    carriers: [{ value: "all", label: "Select a Carrier" }],
    policyNumbers: [],
    statuses: [{ value: "all", label: "Select a Status" }],
    leadSources: [{ value: "all", label: "All Lead Sources" }],
    hasAlertOptions: [
      { value: "all", label: "All" },
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" }
    ]
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

        // Fetch agency's lead sources
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('agency_id')
            .eq('auth_user_id', user.id)
            .single()

          if (userData?.agency_id) {
            const { data: agencyData } = await supabase
              .from('agencies')
              .select('lead_sources')
              .eq('id', userData.agency_id)
              .single()

            if (agencyData?.lead_sources) {
              const leadSourceOptions = [
                { value: "all", label: "All Lead Sources" },
                ...agencyData.lead_sources.map((source: string) => ({
                  value: source,
                  label: source
                }))
              ]
              data.leadSources = leadSourceOptions
            }
          }
        }

        setFilterOptions(data)
      } catch (err) {
        console.error('Error fetching filter options:', err)
        setError('Failed to load filter options')
      }
    }

    fetchFilterOptions()
  }, [])

  // Fetch deals data
  const fetchDeals = async (reset: boolean = true) => {
    if (reset) setLoading(true)
    else setIsLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (selectedAgent !== 'all') params.append('agent_id', selectedAgent)
      if (selectedCarrier !== 'all') params.append('carrier_id', selectedCarrier)
      if (policyNumberSearch) params.append('policy_number', policyNumberSearch)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      if (selectedLeadSource !== 'all') params.append('lead_source', selectedLeadSource)
      if (clientSearch) params.append('client_name', clientSearch)
      params.append('limit', '50')
      if (!reset && nextCursor) {
        params.append('cursor_created_at', nextCursor.cursor_created_at)
        params.append('cursor_id', nextCursor.cursor_id)
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
  }

  // Fetch deals when filters change
  useEffect(() => {
    setNextCursor(null)
    fetchDeals(true)
  }, [selectedAgent, selectedCarrier, policyNumberSearch, selectedStatus, selectedLeadSource, clientSearch])

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

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient">Book of Business</h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-destructive/20 border border-destructive/30 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="professional-card filter-container">
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* First Row - Primary Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Agent
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.agents}
                  value={selectedAgent}
                  onValueChange={setSelectedAgent}
                  placeholder="Select an Agent"
                  searchPlaceholder="Search agents..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Carrier
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.carriers}
                  value={selectedCarrier}
                  onValueChange={setSelectedCarrier}
                  placeholder="Select a Carrier"
                  searchPlaceholder="Search carriers..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Policy #
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.policyNumbers}
                  value={policyNumberSearch}
                  onValueChange={setPolicyNumberSearch}
                  placeholder="Enter a Policy Number"
                  searchPlaceholder="Search policy numbers..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Status
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.statuses}
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                  placeholder="Select a Status"
                  searchPlaceholder="Search status..."
                />
              </div>
            </div>

            {/* Second Row - Additional Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Client
                </label>
                <Input
                  type="text"
                  placeholder="Enter Client's Name"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Lead Source
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.leadSources}
                  value={selectedLeadSource}
                  onValueChange={setSelectedLeadSource}
                  placeholder="Select Lead Source"
                  searchPlaceholder="Search lead sources..."
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
                  <th>Carrier</th>
                  <th>Product</th>
                  <th>Policy #</th>
                  <th>App #</th>
                  <th>Client Name</th>
                  <th>Client Phone</th>
                  <th>Effective Date</th>
                  <th className="text-right">Annual Premium</th>
                  <th>Billing Cycle</th>
                  <th>Lead Source</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-muted-foreground">
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
                        <td>{deal.date}</td>
                        <td>{deal.agent}</td>
                        <td>{deal.carrier}</td>
                        <td>{deal.product}</td>
                        <td>{deal.policyNumber}</td>
                        <td>{deal.appNumber}</td>
                        <td>{deal.clientName}</td>
                        <td>{deal.clientPhone}</td>
                        <td>{deal.effectiveDate}</td>
                        <td className="text-right">
                          <span className="text-primary font-semibold text-base">{deal.annualPremium}</span>
                        </td>
                        <td>
                          {deal.billingCycle ? (
                            <Badge
                              className={`${getBillingCycleColor(deal.billingCycle)} border capitalize`}
                              variant="outline"
                            >
                              {deal.billingCycle}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
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