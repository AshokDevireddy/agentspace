"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"
import { Filter, X, User } from "lucide-react"
import { cn } from "@/lib/utils"

// Client data type
interface Client {
  id: string
  name: string
  email: string
  phone: string
  supportingAgent: string
  status: string
  created: string
}

// Status color mapping
const statusColors: { [key: string]: string } = {
  "pre-invite": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "invited": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "onboarding": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "active": "bg-green-500/20 text-green-400 border-green-500/30",
  "inactive": "bg-red-500/20 text-red-400 border-red-500/30",
}

const generateClientOptions = (clients: Client[]) => {
  const options = [{ value: "all", label: "All Clients" }]
  clients.forEach(client => {
    // Format as "Name - email" so users can search by either
    options.push({
      value: client.id,
      label: `${client.name} - ${client.email}`
    })
  })
  return options
}

const generateAgentOptions = (clients: Client[]) => {
  const agents = new Set(clients.map(client => client.supportingAgent))
  const options = [{ value: "all", label: "All Agents" }]
  agents.forEach(agent => {
    if (agent !== 'N/A') {
      options.push({ value: agent, label: agent })
    }
  })
  return options
}

const generateStatusOptions = () => {
  return [
    { value: "all", label: "All Statuses" },
    { value: "pre-invite", label: "Pre-Invite" },
    { value: "invited", label: "Invited" },
    { value: "onboarding", label: "Onboarding" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]
}

export default function Clients() {
  // Local filter state (what user selects but hasn't applied yet)
  const [localClientName, setLocalClientName] = useState("all")
  const [localAgent, setLocalAgent] = useState("all")
  const [localStatus, setLocalStatus] = useState("all")
  const [localStartDate, setLocalStartDate] = useState("")
  const [localEndDate, setLocalEndDate] = useState("")

  // Active filter state (what's actually applied)
  const [selectedClientName, setSelectedClientName] = useState("all")
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedStartDate, setSelectedStartDate] = useState("")
  const [selectedEndDate, setSelectedEndDate] = useState("")

  const [clientsData, setClientsData] = useState<Client[]>([])
  const [allClients, setAllClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewMode, setViewMode] = useState<'downlines' | 'self' | 'all'>('self')
  const { user } = useAuth()
  const supabase = createClient()

  // Check if user is admin and set default view mode
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) return

      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .single()

      const adminStatus = userData?.is_admin || false
      setIsAdmin(adminStatus)

      // Set default view mode based on admin status
      setViewMode(adminStatus ? 'all' : 'self')
    }

    checkAdminStatus()
  }, [user?.id])

  // Fetch all clients for dropdown options (without pagination)
  useEffect(() => {
    const fetchAllClients = async () => {
      try {
        const url = `/api/clients?page=1&limit=1000&view=${viewMode}`
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch clients')
        }
        const data = await response.json()
        setAllClients(data.clients || [])
      } catch (err) {
        console.error('Error fetching all clients:', err)
      }
    }

    fetchAllClients()
  }, [viewMode])

  // Fetch clients data from API
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true)
        const url = `/api/clients?page=${currentPage}&limit=20&view=${viewMode}`
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch clients')
        }
        const data = await response.json()

        setClientsData(data.clients)
        setTotalPages(data.pagination.totalPages)
        setTotalCount(data.pagination.totalCount)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Error fetching clients:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchClients()
  }, [currentPage, viewMode])

  // Apply filters when button is clicked
  const handleApplyFilters = () => {
    setSelectedClientName(localClientName)
    setSelectedAgent(localAgent)
    setSelectedStatus(localStatus)
    setSelectedStartDate(localStartDate)
    setSelectedEndDate(localEndDate)
    setCurrentPage(1)
  }

  // Clear all filters
  const handleClearFilters = () => {
    setLocalClientName("all")
    setLocalAgent("all")
    setLocalStatus("all")
    setLocalStartDate("")
    setLocalEndDate("")
    setSelectedClientName("all")
    setSelectedAgent("all")
    setSelectedStatus("all")
    setSelectedStartDate("")
    setSelectedEndDate("")
    setCurrentPage(1)
  }

  const filteredClients = clientsData.filter((client: Client) => {
    const matchesClient = selectedClientName === "all" || client.id === selectedClientName
    const matchesAgent = selectedAgent === "all" || client.supportingAgent === selectedAgent
    const matchesStatus = selectedStatus === "all" || client.status === selectedStatus

    let matchesDateRange = true
    if (selectedStartDate || selectedEndDate) {
      const clientDate = new Date(client.created)
      if (selectedStartDate) {
        matchesDateRange = matchesDateRange && clientDate >= new Date(selectedStartDate)
      }
      if (selectedEndDate) {
        matchesDateRange = matchesDateRange && clientDate <= new Date(selectedEndDate)
      }
    }

    return matchesClient && matchesAgent && matchesStatus && matchesDateRange
  })

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading clients...</div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-destructive">Error: {error}</div>
        </div>
      </div>
    )
  }

  const clientOptions = generateClientOptions(allClients)
  const agentOptions = generateAgentOptions(allClients)
  const statusOptions = generateStatusOptions()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold text-gradient">Clients</h1>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            {isAdmin && (
              <>
                <Button
                  variant={viewMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('all')}
                  className={viewMode === 'all' ? 'btn-gradient' : ''}
                >
                  Everyone
                </Button>
                <Button
                  variant={viewMode === 'self' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('self')}
                  className={viewMode === 'self' ? 'btn-gradient' : ''}
                >
                  Just Me
                </Button>
              </>
            )}
            {!isAdmin && (
              <Button
                variant={viewMode === 'self' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('self')}
                className={viewMode === 'self' ? 'btn-gradient' : ''}
              >
                Just Me
              </Button>
            )}
            <Button
              variant={viewMode === 'downlines' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('downlines')}
              className={viewMode === 'downlines' ? 'btn-gradient' : ''}
            >
              Downlines Only
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="professional-card filter-container !rounded-md">
        <CardContent className="p-2">
          <div className="flex items-end gap-2 flex-wrap">
            {/* Client Name/Email */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                Client
              </label>
              <SimpleSearchableSelect
                options={clientOptions}
                value={localClientName}
                onValueChange={setLocalClientName}
                placeholder="All Clients"
                searchPlaceholder="Search..."
              />
            </div>

            {/* Supporting Agent */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                Supporting Agent
              </label>
              <SimpleSearchableSelect
                options={agentOptions}
                value={localAgent}
                onValueChange={setLocalAgent}
                placeholder="All Agents"
                searchPlaceholder="Search..."
              />
            </div>

            {/* Status */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                Status
              </label>
              <SimpleSearchableSelect
                options={statusOptions}
                value={localStatus}
                onValueChange={setLocalStatus}
                placeholder="All Statuses"
                searchPlaceholder="Search..."
              />
            </div>

            {/* Start Date */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                Start Date
              </label>
              <Input
                type="date"
                value={localStartDate}
                onChange={(e) => setLocalStartDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* End Date */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                End Date
              </label>
              <Input
                type="date"
                value={localEndDate}
                onChange={(e) => setLocalEndDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 items-end">
              <Button
                onClick={handleApplyFilters}
                size="sm"
                className="btn-gradient h-8 px-4"
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filter
              </Button>
              {(selectedClientName !== 'all' || selectedAgent !== 'all' || selectedStatus !== 'all' || selectedStartDate || selectedEndDate) && (
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
        </CardContent>
      </Card>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrapper custom-scrollbar">
          <table className="jira-table min-w-full">
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Supporting Agent</th>
                <th>Status</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No clients found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredClients.map((client: Client) => (
                  <tr key={client.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <td>
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold border border-primary/30">
                            <User className="h-4 w-4" />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{client.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground">{client.email}</td>
                    <td className="text-muted-foreground">{client.phone}</td>
                    <td className="font-medium">{client.supportingAgent}</td>
                    <td>
                      <Badge
                        className={cn(
                          "border",
                          statusColors[client.status] || 'bg-muted text-muted-foreground border-border'
                        )}
                        variant="outline"
                      >
                        {client.status.charAt(0).toUpperCase() + client.status.slice(1).replace('-', ' ')}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground">{client.created}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Card className="professional-card border-t-0 rounded-t-none">
          {/* Pagination */}
          <div className="flex items-center justify-between py-4 border-t border-border px-6">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} clients
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                «
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                ‹
              </Button>

              {/* Generate page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={currentPage === pageNum ? "btn-gradient" : ""}
                  >
                    {pageNum}
                  </Button>
                )
              })}

              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                ›
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                »
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

