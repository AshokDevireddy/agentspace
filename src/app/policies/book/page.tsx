"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Loader2 } from "lucide-react"

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
  leadSourceType: string
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

const statusColors = {
  "Draft": "bg-gray-500/20 text-foreground border-gray-500/30",
  "Pending Approval": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Verified": "bg-green-500/20 text-green-400 border-green-500/30",
  "Active": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Terminated": "bg-red-500/20 text-red-400 border-red-500/30"
}

const leadSourceColors = {
  "Referral": "bg-green-500/20 text-green-400 border-green-500/30",
  "Provided": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Purchased": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "No Lead": "bg-gray-500/20 text-foreground border-gray-500/30"
}

export default function BookOfBusiness() {
  const router = useRouter()
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedCarrier, setSelectedCarrier] = useState("all")
  const [policyNumberSearch, setPolicyNumberSearch] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedHasAlert, setSelectedHasAlert] = useState("all")

  // State for API data
  const [deals, setDeals] = useState<Deal[]>([])
  const [nextCursor, setNextCursor] = useState<{ cursor_created_at: string; cursor_id: string } | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    agents: [{ value: "all", label: "Select an Agent" }],
    carriers: [{ value: "all", label: "Select a Carrier" }],
    policyNumbers: [],
    statuses: [
      { value: "all", label: "Select a Status" },
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending Approval" },
      { value: "verified", label: "Verified" },
      { value: "active", label: "Active" },
      { value: "terminated", label: "Terminated" }
    ],
    leadSources: [
      { value: "all", label: "--------" },
      { value: "referral", label: "Referral" },
      { value: "purchased", label: "Purchased Lead" },
      { value: "provided", label: "Provided Lead" },
      { value: "no_lead", label: "No Lead" }
    ],
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
  }, [selectedAgent, selectedCarrier, policyNumberSearch, selectedStatus, clientSearch])

  const handleRowClick = (deal: Deal) => {
    router.push(`/policies/${deal.carrier}/${deal.policyNumber}`)
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
                  Has Alert
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.hasAlertOptions}
                  value={selectedHasAlert}
                  onValueChange={setSelectedHasAlert}
                  placeholder="Select"
                  searchPlaceholder="Search..."
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
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-muted-foreground">
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
                          <span className="text-primary font-medium">{deal.annualPremium}</span>
                        </td>
                        <td className="text-center">
                          <Badge
                            className={`${statusColors[deal.status as keyof typeof statusColors]} border`}
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
    </div>
  )
}