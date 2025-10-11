"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Edit, Trash2, Loader2, Save, X } from "lucide-react"

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
  "Draft": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "Pending Approval": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Verified": "bg-green-500/20 text-green-400 border-green-500/30",
  "Active": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Terminated": "bg-red-500/20 text-red-400 border-red-500/30"
}

const leadSourceColors = {
  "Referral": "bg-green-500/20 text-green-400 border-green-500/30",
  "Provided": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Purchased": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "No Lead": "bg-gray-500/20 text-gray-400 border-gray-500/30"
}

export default function BookOfBusiness() {
  const router = useRouter()
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedCarrier, setSelectedCarrier] = useState("all")
  const [policyNumberSearch, setPolicyNumberSearch] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedLeadSource, setSelectedLeadSource] = useState("all")
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

  // Editing state
  const [editingDealId, setEditingDealId] = useState<string | null>(null)
  const [editingDeal, setEditingDeal] = useState<EditableDeal | null>(null)
  const [saving, setSaving] = useState(false)

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
      if (selectedLeadSource !== 'all') params.append('lead_source', selectedLeadSource)
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
  }, [selectedAgent, selectedCarrier, policyNumberSearch, selectedStatus, clientSearch, selectedLeadSource])

  const handleRowClick = (deal: Deal) => {
    // Only navigate if not editing
    if (editingDealId !== deal.id) {
      router.push(`/policies/${deal.carrierId}/${deal.policyNumber}`)
    }
  }

  const handleEditClick = (e: React.MouseEvent, deal: Deal) => {
    e.stopPropagation()
    setEditingDealId(deal.id)
    setEditingDeal({
      ...deal,
      originalData: { ...deal }
    })
  }

  const handleCancelEdit = () => {
    setEditingDealId(null)
    setEditingDeal(null)
  }

  const handleSaveEdit = async () => {
    if (!editingDeal) return

    setSaving(true)
    try {
      // Convert the editing deal data back to the format expected by the API
      const updateData = {
        client_name: editingDeal.clientName,
        client_phone: editingDeal.clientPhone,
        application_number: editingDeal.appNumber,
        annual_premium: parseFloat(editingDeal.annualPremium.replace('$', '').replace(',', '')),
        monthly_premium: parseFloat(editingDeal.annualPremium.replace('$', '').replace(',', '')) / 12,
        policy_effective_date: editingDeal.effectiveDate,
        lead_source: editingDeal.leadSource === 'No Lead' ? 'no_lead' :
                    editingDeal.leadSource === 'Referral' ? 'referral' :
                    editingDeal.leadSource === 'Provided' ? 'provided' :
                    editingDeal.leadSource === 'Purchased' ? 'purchased' :
                    editingDeal.leadSource.toLowerCase().replace(' ', '_'),
        notes: editingDeal.leadSourceType,
        status: editingDeal.status === 'Pending Approval' ? 'pending' :
                editingDeal.status === 'Verified' ? 'verified' :
                editingDeal.status === 'Active' ? 'active' :
                editingDeal.status === 'Terminated' ? 'terminated' : 'draft'
      }

      const response = await fetch(`/api/deals/${editingDeal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update deal')
      }

      // Refresh the deals list
      await fetchDeals()
      setEditingDealId(null)
      setEditingDeal(null)
    } catch (err) {
      console.error('Error updating deal:', err)
      setError(err instanceof Error ? err.message : 'Failed to update deal')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof EditableDeal, value: string) => {
    if (!editingDeal) return
    setEditingDeal({ ...editingDeal, [field]: value })
  }

  const isEditing = (dealId: string) => editingDealId === dealId

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
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* First Row - Primary Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Client
                </label>
                <Input
                  type="text"
                  placeholder="Enter Client's Name"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Lead Source
                </label>
                <SimpleSearchableSelect
                  options={filterOptions.leadSources}
                  value={selectedLeadSource}
                  onValueChange={setSelectedLeadSource}
                  placeholder="--------"
                  searchPlaceholder="Search lead sources..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
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
        <div className="table-wrapper">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading deals...</span>
            </div>
          ) : (
            <table className="professional-table min-w-full">
              <thead>
                <tr>
                  <th className="text-left">Date</th>
                  <th className="text-left">Agent</th>
                  <th className="text-left">Carrier</th>
                  <th className="text-left">Product</th>
                  <th className="text-left">Policy #</th>
                  <th className="text-left">App #</th>
                  <th className="text-left">Client Name</th>
                  <th className="text-left">Client Phone</th>
                  <th className="text-left">Effective Date</th>
                  <th className="text-right">Annual Premium</th>
                  <th className="text-center">Lead Source</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
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
                      className={`transition-colors ${
                        isEditing(deal.id) ? 'bg-primary/10' : 'cursor-pointer hover:bg-accent/30'
                      }`}
                      onClick={() => handleRowClick(deal)}
                    >
                        <td className="text-foreground">{deal.date}</td>
                        <td className="text-foreground">{deal.agent}</td>
                        <td className="text-foreground">{deal.carrier}</td>
                        <td className="text-foreground">{deal.product}</td>
                        <td className="text-foreground">{deal.policyNumber}</td>
                        <td>
                          {isEditing(deal.id) ? (
                            <Input
                              value={editingDeal?.appNumber || ''}
                              onChange={(e) => handleInputChange('appNumber', e.target.value)}
                              className="w-24"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="text-foreground">{deal.appNumber}</span>
                          )}
                        </td>
                        <td>
                          {isEditing(deal.id) ? (
                            <Input
                              value={editingDeal?.clientName || ''}
                              onChange={(e) => handleInputChange('clientName', e.target.value)}
                              className="w-32"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="text-foreground">{deal.clientName}</span>
                          )}
                        </td>
                        <td>
                          {isEditing(deal.id) ? (
                            <Input
                              value={editingDeal?.clientPhone || ''}
                              onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                              className="w-28"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="text-foreground">{deal.clientPhone}</span>
                          )}
                        </td>
                        <td>
                          {isEditing(deal.id) ? (
                            <Input
                              type="date"
                              value={editingDeal?.effectiveDate || ''}
                              onChange={(e) => handleInputChange('effectiveDate', e.target.value)}
                              className="w-32"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="text-foreground">{deal.effectiveDate}</span>
                          )}
                        </td>
                        <td className="text-right">
                          {isEditing(deal.id) ? (
                            <Input
                              value={editingDeal?.annualPremium.replace('$', '') || ''}
                              onChange={(e) => handleInputChange('annualPremium', `$${e.target.value}`)}
                              className="w-24 text-right"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="text-primary font-medium">{deal.annualPremium}</span>
                          )}
                        </td>
                        <td className="text-center">
                          {isEditing(deal.id) ? (
                            <div className="flex flex-col items-center space-y-1">
                              <SimpleSearchableSelect
                                options={filterOptions.leadSources.filter(option => option.value !== 'all')}
                                value={editingDeal?.leadSource === 'No Lead' ? 'no_lead' :
                                       editingDeal?.leadSource === 'Referral' ? 'referral' :
                                       editingDeal?.leadSource === 'Provided' ? 'provided' :
                                       editingDeal?.leadSource === 'Purchased' ? 'purchased' :
                                       editingDeal?.leadSource.toLowerCase().replace(' ', '_') || ''}
                                onValueChange={(value) => {
                                  const leadSourceMap = {
                                    'no_lead': 'No Lead',
                                    'referral': 'Referral',
                                    'provided': 'Provided',
                                    'purchased': 'Purchased'
                                  }
                                  handleInputChange('leadSource', leadSourceMap[value as keyof typeof leadSourceMap] || value.replace('_', ' '))
                                }}
                                placeholder="Select Lead Source"
                                searchPlaceholder="Search..."
                              />
                              <Input
                                value={editingDeal?.leadSourceType || ''}
                                onChange={(e) => handleInputChange('leadSourceType', e.target.value)}
                                placeholder="Type"
                                className="w-20 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center space-y-1">
                              <Badge
                                className={`${leadSourceColors[deal.leadSource as keyof typeof leadSourceColors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'} border`}
                                variant="outline"
                              >
                                {deal.leadSource}
                              </Badge>
                              {deal.leadSourceType && (
                                <span className="text-xs text-muted-foreground">{deal.leadSourceType}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          {isEditing(deal.id) ? (
                            <SimpleSearchableSelect
                              options={filterOptions.statuses.filter(option => option.value !== 'all')}
                              value={editingDeal?.status === 'Pending Approval' ? 'pending' :
                                     editingDeal?.status === 'Verified' ? 'verified' :
                                     editingDeal?.status === 'Active' ? 'active' :
                                     editingDeal?.status === 'Terminated' ? 'terminated' : 'draft'}
                              onValueChange={(value) => {
                                const statusMap = {
                                  'pending': 'Pending Approval',
                                  'verified': 'Verified',
                                  'active': 'Active',
                                  'terminated': 'Terminated',
                                  'draft': 'Draft'
                                }
                                handleInputChange('status', statusMap[value as keyof typeof statusMap] || 'Draft')
                              }}
                              placeholder="Select Status"
                              searchPlaceholder="Search..."
                            />
                          ) : (
                            <Badge
                              className={`${statusColors[deal.status as keyof typeof statusColors]} border`}
                              variant="outline"
                            >
                              {deal.status}
                            </Badge>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {isEditing(deal.id) ? (
                              <>
                                <button
                                  className="text-green-400 hover:text-green-300 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSaveEdit()
                                  }}
                                  disabled={saving}
                                >
                                  {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCancelEdit()
                                  }}
                                  disabled={saving}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  onClick={(e) => handleEditClick(e, deal)}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Handle delete action
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
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