"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { useAuth } from "@/providers/AuthProvider"
import { Filter, X, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { RefreshingIndicator } from "@/components/ui/refreshing-indicator"
import { usePersistedFilters } from "@/hooks/usePersistedFilters"
import { useApiFetch } from "@/hooks/useApiFetch"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/hooks/queryKeys"
import { QueryErrorDisplay } from "@/components/ui/query-error-display"
import { useAdminStatus } from "@/hooks/useUserQueries"

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
  // Persisted filter state using custom hook (includes view mode)
  const { localFilters, appliedFilters, setLocalFilters, applyFilters, clearFilters, setAndApply } = usePersistedFilters(
    'clients',
    {
      clientName: "all",
      agent: "all",
      status: "all",
      startDate: "",
      endDate: "",
      viewMode: 'self' as 'downlines' | 'self'
    },
    ['viewMode'] // Preserve viewMode when clearing filters
  )

  // Use persisted view mode - setAndApply updates immediately
  const viewMode = appliedFilters.viewMode
  const setViewMode = (value: 'downlines' | 'self') => {
    setAndApply({ viewMode: value })
  }

  const [currentPage, setCurrentPage] = useState(1)
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Check if user is admin using centralized hook
  const { data: adminData, isPending: isAdminLoading } = useAdminStatus(user?.id)
  const isAdmin = adminData?.is_admin || false
  // Wait for both loading to complete AND data to be available to prevent race conditions
  const isAdminChecked = !isAdminLoading && adminData !== undefined

  // For admins viewing "downlines", we actually fetch "all"
  const effectiveViewMode = (isAdmin && viewMode === 'downlines') ? 'all' : viewMode

  // Fetch all clients for dropdown options (without pagination)
  const { data: allClientsData } = useApiFetch<{ clients: Client[] }>(
    queryKeys.clientsAll(effectiveViewMode),
    `/api/clients?page=1&limit=1000&view=${effectiveViewMode}`,
    { enabled: isAdminChecked }
  )

  const allClients = allClientsData?.clients || []

  // Fetch clients data from API with pagination
  const { data: clientsResponse, isPending: clientsLoading, isFetching: clientsFetching, error: clientsError } = useApiFetch<{
    clients: Client[]
    pagination: {
      totalPages: number
      totalCount: number
      currentPage: number
      limit: number
    }
  }>(
    queryKeys.clientsList(currentPage, { view: effectiveViewMode }),
    `/api/clients?page=${currentPage}&limit=20&view=${effectiveViewMode}`,
    {
      enabled: isAdminChecked,
      staleTime: 30 * 1000, // 30 seconds
      placeholderData: (previousData) => previousData, // Keep previous data while fetching (stale-while-revalidate)
    }
  )

  const clientsData = clientsResponse?.clients || []
  const totalPages = clientsResponse?.pagination.totalPages || 1
  const totalCount = clientsResponse?.pagination.totalCount || 0
  const loading = isAdminLoading || clientsLoading
  const isRefreshing = clientsFetching && !clientsLoading // Background refetch with stale data shown

  // Apply filters when button is clicked
  const handleApplyFilters = () => {
    applyFilters()
    setCurrentPage(1)
  }

  // Clear all filters
  const handleClearFilters = () => {
    clearFilters()
    setCurrentPage(1)
  }

  const filteredClients = clientsData.filter((client: Client) => {
    const matchesClient = appliedFilters.clientName === "all" || client.id === appliedFilters.clientName
    const matchesAgent = appliedFilters.agent === "all" || client.supportingAgent === appliedFilters.agent
    const matchesStatus = appliedFilters.status === "all" || client.status === appliedFilters.status

    let matchesDateRange = true
    if (appliedFilters.startDate || appliedFilters.endDate) {
      const clientDate = new Date(client.created)
      if (appliedFilters.startDate) {
        matchesDateRange = matchesDateRange && clientDate >= new Date(appliedFilters.startDate)
      }
      if (appliedFilters.endDate) {
        matchesDateRange = matchesDateRange && clientDate <= new Date(appliedFilters.endDate)
      }
    }

    return matchesClient && matchesAgent && matchesStatus && matchesDateRange
  })

  // Error will be shown inline in the table, not blocking the whole page

  const clientOptions = generateClientOptions(allClients)
  const agentOptions = generateAgentOptions(allClients)
  const statusOptions = generateStatusOptions()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-gradient">Clients</h1>
            <RefreshingIndicator isRefreshing={isRefreshing} />
          </div>

          {/* View Mode Toggle with Slider */}
          <div className="relative bg-accent/30 rounded-lg p-1">
            <div className="grid grid-cols-2 gap-1 relative">
              {/* Animated slider background */}
              <div
                className={cn(
                  "absolute h-[calc(100%-8px)] bg-gradient-to-r from-blue-600 to-blue-500 rounded-md transition-all duration-300 ease-in-out top-1 shadow-md",
                  viewMode === 'self' ? 'left-1 right-[calc(50%+2px)]' : 'left-[calc(50%+2px)] right-1'
                )}
              />

              {/* Buttons */}
              <button
                onClick={() => setViewMode('self')}
                disabled={loading || !isAdminChecked}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300",
                  viewMode === 'self'
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground',
                  (loading || !isAdminChecked) && 'opacity-50 cursor-not-allowed'
                )}
              >
                Just Me
              </button>
              <button
                onClick={() => setViewMode('downlines')}
                disabled={loading || !isAdminChecked}
                className={cn(
                  "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300",
                  viewMode === 'downlines'
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground',
                  (loading || !isAdminChecked) && 'opacity-50 cursor-not-allowed'
                )}
              >
                Downlines
              </button>
            </div>
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
                value={localFilters.clientName}
                onValueChange={(value) => setLocalFilters({ clientName: value })}
                placeholder="All Clients"
                searchPlaceholder="Search..."
                disabled={loading || !isAdminChecked}
              />
            </div>

            {/* Supporting Agent */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                Supporting Agent
              </label>
              <SimpleSearchableSelect
                options={agentOptions}
                value={localFilters.agent}
                onValueChange={(value) => setLocalFilters({ agent: value })}
                placeholder="All Agents"
                searchPlaceholder="Search..."
                disabled={loading || !isAdminChecked}
              />
            </div>

            {/* Status */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                Status
              </label>
              <SimpleSearchableSelect
                options={statusOptions}
                value={localFilters.status}
                onValueChange={(value) => setLocalFilters({ status: value })}
                placeholder="All Statuses"
                searchPlaceholder="Search..."
                disabled={loading || !isAdminChecked}
              />
            </div>

            {/* Start Date */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                Start Date
              </label>
              <Input
                type="date"
                value={localFilters.startDate}
                onChange={(e) => setLocalFilters({ startDate: e.target.value })}
                className="h-8 text-sm"
                disabled={loading || !isAdminChecked}
              />
            </div>

            {/* End Date */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                End Date
              </label>
              <Input
                type="date"
                value={localFilters.endDate}
                onChange={(e) => setLocalFilters({ endDate: e.target.value })}
                className="h-8 text-sm"
                disabled={loading || !isAdminChecked}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 items-end">
              <Button
                onClick={handleApplyFilters}
                size="sm"
                className="btn-gradient h-8 px-4"
                disabled={loading || !isAdminChecked}
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filter
              </Button>
              {(appliedFilters.clientName !== 'all' || appliedFilters.agent !== 'all' || appliedFilters.status !== 'all' || appliedFilters.startDate || appliedFilters.endDate) && (
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
              {loading || !isAdminChecked ? (
                // Skeleton loaders for table rows
                Array.from({ length: 10 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                        <div className="h-4 w-32 bg-muted rounded" />
                      </div>
                    </td>
                    <td><div className="h-4 w-40 bg-muted rounded" /></td>
                    <td><div className="h-4 w-24 bg-muted rounded" /></td>
                    <td><div className="h-4 w-28 bg-muted rounded" /></td>
                    <td><div className="h-5 w-16 bg-muted rounded" /></td>
                    <td><div className="h-4 w-20 bg-muted rounded" /></td>
                  </tr>
                ))
              ) : clientsError ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <QueryErrorDisplay
                      error={clientsError}
                      onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.clientsList(currentPage, { view: effectiveViewMode }) })}
                      variant="inline"
                    />
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
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
            {loading || !isAdminChecked ? (
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} clients
              </div>
            )}
            <div className="flex items-center space-x-2">
              {loading || !isAdminChecked ? (
                <div className="flex items-center space-x-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-8 w-8 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

