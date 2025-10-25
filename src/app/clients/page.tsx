"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"
import { Search, User } from "lucide-react"
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
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [clientsData, setClientsData] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewMode, setViewMode] = useState<'downlines' | 'self' | 'all'>('downlines')
  const { user } = useAuth()
  const supabase = createClient()

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) return

      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .single()

      setIsAdmin(userData?.is_admin || false)
    }

    checkAdminStatus()
  }, [user?.id])

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

  const filteredClients = clientsData.filter((client: Client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesAgent = selectedAgent === "all" || client.supportingAgent === selectedAgent
    const matchesStatus = selectedStatus === "all" || client.status === selectedStatus

    let matchesDateRange = true
    if (startDate || endDate) {
      const clientDate = new Date(client.created)
      if (startDate) {
        matchesDateRange = matchesDateRange && clientDate >= new Date(startDate)
      }
      if (endDate) {
        matchesDateRange = matchesDateRange && clientDate <= new Date(endDate)
      }
    }

    return matchesSearch && matchesAgent && matchesStatus && matchesDateRange
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

  const agentOptions = generateAgentOptions(clientsData)
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

      {/* Search and Filters */}
      <Card className="professional-card filter-container">
        <CardContent className="p-3">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search clients by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {/* Supporting Agent */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Supporting Agent
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={selectedAgent}
                  onValueChange={setSelectedAgent}
                  placeholder="All Agents"
                  searchPlaceholder="Search agents..."
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Status
                </label>
                <SimpleSearchableSelect
                  options={statusOptions}
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                  placeholder="All Statuses"
                  searchPlaceholder="Search status..."
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
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

