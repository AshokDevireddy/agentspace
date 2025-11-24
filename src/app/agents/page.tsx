"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Tree, CustomNodeElementProps } from 'react-d3-tree';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import AddUserModal from "@/components/modals/add-user-modal"
import { Plus, Users, List, GitMerge, Filter, X, ChevronDown, ChevronRight, UserCog, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { usePersistedFilters } from "@/hooks/usePersistedFilters"

// Agent data type
interface Agent {
  id: string
  name: string
  position: string
  upline: string
  created: string
  lastLogin: string
  earnings: string
  downlines: number
  status: string
  badge: string
  position_id?: string | null
  position_name?: string | null
  position_level?: number | null
}

interface TreeNode {
    name: string;
    attributes?: {
      [key: string]: string;
    };
    children?: TreeNode[];
}

interface PendingAgent {
  agent_id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  role: string
  upline_name: string | null
  created_at: string
}

interface Position {
  position_id: string
  name: string
  level: number
  description: string | null
  is_active: boolean
}

const badgeColors: { [key: string]: string } = {
  "Legacy Junior Partner": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Karma Director 2": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Karma Director 1": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Legacy MGA": "bg-green-500/20 text-green-400 border-green-500/30",
  "Legacy GA": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Legacy SA": "bg-red-500/20 text-red-400 border-red-500/30",
}

const statusColors: { [key: string]: string } = {
  "pre-invite": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "invited": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "onboarding": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "active": "bg-green-500/20 text-green-400 border-green-500/30",
  "inactive": "bg-red-500/20 text-red-400 border-red-500/30",
}


const renderForeignObjectNode = ({
  nodeDatum,
  toggleNode,
  foreignObjectProps
}: any) => {
  const hasChildren = nodeDatum.children && nodeDatum.children.length > 0
  const isCollapsed = nodeDatum.__rd3t?.collapsed ?? false

  return (
    <g>
      <foreignObject {...foreignObjectProps}>
        <div style={{
          backgroundColor: "#ffffff",
          border: "2px solid #e5e7eb",
          borderRadius: "8px",
          color: "#111827",
          padding: "16px",
          minWidth: "200px",
          position: "relative",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
        }}>
          {/* Collapse/Expand Button */}
          {hasChildren && (
            <button
              onClick={toggleNode}
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6b7280",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "#f3f4f6";
                (e.target as HTMLButtonElement).style.borderColor = "#9ca3af";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.target as HTMLButtonElement).style.borderColor = "#d1d5db";
              }}
            >
              {isCollapsed ? (
                <ChevronRight style={{ width: "16px", height: "16px" }} />
              ) : (
                <ChevronDown style={{ width: "16px", height: "16px" }} />
              )}
            </button>
          )}

          {/* Header with position badge */}
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px"
            }}>
              <div style={{
                backgroundColor: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "10px",
                fontWeight: "600",
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {nodeDatum.attributes?.position || "Agent"}
              </div>
            </div>

            <h3 style={{
              textAlign: "center",
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "700",
              color: "#111827",
              letterSpacing: "0.025em",
              lineHeight: "1.2"
            }}>{nodeDatum.name}</h3>

            {/* Attributes in a cleaner layout */}
            <div style={{ marginBottom: "16px" }}>
              {nodeDatum.attributes &&
                Object.entries(nodeDatum.attributes)
                  .filter(([label]) => label !== "position")
                  .map(([label, value], index) => (
                  <div key={`${label}-${index}`} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "#6b7280",
                    marginBottom: "6px",
                    padding: "2px 0"
                  }}>
                    <span style={{
                      color: "#9ca3af",
                      fontWeight: "500",
                      textTransform: "capitalize"
                    }}>{label}:</span>
                    <span style={{
                      color: "#374151",
                      fontWeight: "600"
                    }}>{String(value)}</span>
                  </div>
                ))}
            </div>

            {/* Modern Add Agent Button */}
            <div style={{ display: 'flex', justifyContent: 'center'}}>
                <AddUserModal trigger={
                    <button style={{
                      backgroundColor: "#f9fafb",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = "#f3f4f6";
                      (e.target as HTMLButtonElement).style.borderColor = "#9ca3af";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = "#f9fafb";
                      (e.target as HTMLButtonElement).style.borderColor = "#d1d5db";
                    }}>
                        <span style={{ fontSize: "14px" }}>+</span> Add Agent
                    </button>
                } upline={nodeDatum.name} />
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  )
}


export default function Agents() {
  // Persisted filter state using custom hook (includes view/tab state)
  const [localFilters, appliedFilters, setLocalFilters, applyFilters, clearFilters, setAndApply] = usePersistedFilters(
    'agents',
    {
      inUpline: "all",
      directUpline: "all",
      inDownline: "all",
      directDownline: "all",
      agentName: "all",
      status: "all",
      position: "all",
      view: 'table' as 'table' | 'tree' | 'pending-positions'
    }
  )

  // Use persisted view state - setAndApply updates immediately without double-click
  const view = appliedFilters.view
  const setView = (value: 'table' | 'tree' | 'pending-positions') => {
    setAndApply({ view: value })
  }

  const [agentsData, setAgentsData] = useState<Agent[]>([])
  const [allAgents, setAllAgents] = useState<Array<{ id: string; name: string }>>([])
  const [treeData, setTreeData] = useState<TreeNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })

  // Pending positions state
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [positions, setPositions] = useState<Position[]>([]) // For pending positions assignment (filtered by user level)
  const [filterPositions, setFilterPositions] = useState<Position[]>([]) // For filter dropdown (all agency positions)
  const [assigningAgentId, setAssigningAgentId] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string>("")
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null)

  const formatUplineLabel = (upline?: string | null) => {
    if (!upline) return 'None'
    const normalized = upline.replace(/[\s,]/g, '')
    return normalized ? upline : 'None'
  }

    const containerRef = useCallback((containerElem: HTMLDivElement | null) => {
        if (containerElem !== null) {
            const { width, height } = containerElem.getBoundingClientRect();
            setTranslate({ x: width / 2, y: height / 5 });
        }
    }, []);

  // Fetch agents data from API (only when active filters change, not local filters)
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true)

        // Build query params
        const params = new URLSearchParams()
        if (view === 'table') {
          params.append('page', currentPage.toString())
          params.append('limit', '20')
        } else {
          params.append('view', 'tree')
        }

        // Add active filter parameters
        if (appliedFilters.inUpline && appliedFilters.inUpline !== 'all') {
          params.append('inUpline', appliedFilters.inUpline)
        }
        if (appliedFilters.directUpline && appliedFilters.directUpline !== 'all') {
          params.append('directUpline', appliedFilters.directUpline)
        }
        if (appliedFilters.inDownline && appliedFilters.inDownline !== 'all') {
          params.append('inDownline', appliedFilters.inDownline)
        }
        if (appliedFilters.directDownline && appliedFilters.directDownline !== 'all') {
          params.append('directDownline', appliedFilters.directDownline)
        }
        if (appliedFilters.agentName && appliedFilters.agentName !== 'all') {
          params.append('agentName', appliedFilters.agentName)
        }
        if (appliedFilters.status && appliedFilters.status !== 'all') {
          params.append('status', appliedFilters.status)
        }
        if (appliedFilters.position && appliedFilters.position !== 'all') {
          params.append('positionId', appliedFilters.position)
        }

        const url = `/api/agents?${params.toString()}`
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch agents')
        }
        const data = await response.json()

        if(view === 'table') {
            setAgentsData(data.agents)
            setTotalPages(data.pagination.totalPages)
            setTotalCount(data.pagination.totalCount)
            if (data.allAgents) {
              setAllAgents(data.allAgents)
            }
        } else {
            setTreeData(data.tree)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Error fetching agents:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [currentPage, view, appliedFilters])

  // Fetch pending agents count for badge (runs on mount and when view changes)
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          console.error('No access token available')
          return
        }

        const response = await fetch('/api/agents/without-positions', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          setPendingCount(data.count || 0)
          // If we're on pending positions view, also set the full list
          if (view === 'pending-positions') {
            setPendingAgents(data.agents || [])
          }
        } else {
          console.error('Failed to fetch pending agents:', response.status, await response.text())
        }
      } catch (err) {
        console.error('Error fetching pending agents count:', err)
      }
    }

    fetchPendingCount()
  }, [view])

  // Fetch positions for assignment dropdown (filtered by user's level)
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          console.error('No access token available')
          return
        }

        // Fetch positions with Bearer token
        const response = await fetch('/api/positions', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()

          // Fetch current user's position level to filter positions
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: userData } = await supabase
              .from('users')
              .select('position_id, position:positions(level)')
              .eq('auth_user_id', user.id)
              .single()

            const currentUserPositionLevel = userData?.position?.level

            // Filter positions: only show positions BELOW current user's level (not including their level)
            const filteredData = currentUserPositionLevel !== null && currentUserPositionLevel !== undefined
              ? data.filter((pos: any) => pos.level < currentUserPositionLevel)
              : data

            setPositions(filteredData || [])
          } else {
            setPositions(data || [])
          }
        } else {
          console.error('Failed to fetch positions:', response.status, await response.text())
        }
      } catch (err) {
        console.error('Error fetching positions:', err)
      }
    }

    if (view === 'pending-positions') {
      fetchPositions()
    }
  }, [view])

  // Fetch all positions for filter dropdown (table view) - no filtering, just all agency positions
  useEffect(() => {
    const fetchFilterPositions = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          console.error('No access token available')
          return
        }

        // Fetch all positions for the agency (no level filtering)
        const response = await fetch('/api/positions', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          setFilterPositions(data || [])
        } else {
          console.error('Failed to fetch filter positions:', response.status, await response.text())
        }
      } catch (err) {
        console.error('Error fetching filter positions:', err)
      }
    }

    if (view === 'table') {
      fetchFilterPositions()
    }
  }, [view])

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

  // Handle position assignment
  const handleAssignPosition = async (agentId: string, positionId: string) => {
    if (!positionId) {
      alert('Please select a position')
      return
    }

    try {
      setAssigningAgentId(agentId)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('Unable to assign position without a valid session. Please log in again.')
      }

      const response = await fetch('/api/agents/assign-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          agent_id: agentId,
          position_id: positionId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign position')
      }

      // Remove the agent from pending list
      setPendingAgents(prev => prev.filter(a => a.agent_id !== agentId))
      setPendingCount(prev => Math.max(0, prev - 1))
      setSelectedPositionId("")

      alert('Position assigned successfully!')
    } catch (err) {
      console.error('Error assigning position:', err)
      alert(err instanceof Error ? err.message : 'Failed to assign position')
    } finally {
      setAssigningAgentId(null)
    }
  }

  // Handle resend invite
  const handleResendInvite = async (agentId: string) => {
    try {
      setResendingInviteId(agentId)
      const response = await fetch('/api/agents/resend-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      alert(data.message || 'Invitation resent successfully!')
    } catch (err) {
      console.error('Error resending invite:', err)
      alert(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setResendingInviteId(null)
    }
  }

  // Show error state (but still show the UI structure)
  if (error) {
    // Error will be shown in the content area, not blocking the whole page
  }

  // Generate agent options for dropdowns
  const agentOptions = [
    { value: "all", label: "All Agents" },
    ...allAgents.map(agent => ({ value: agent.name, label: agent.name }))
  ]

  // Generate status options
  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "pre-invite", label: "Pre-Invite" },
    { value: "invited", label: "Invited" },
    { value: "onboarding", label: "Onboarding" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]

  const nodeSize = { x: 220, y: 200 };
  const foreignObjectProps = { width: nodeSize.x, height: nodeSize.y, x: -110, y: 10 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold text-foreground">Agents</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
              <Button
                variant={view === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('table')}
                disabled={loading}
                className={`flex items-center gap-2 ${view === 'table' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}
              >
                <List className="h-4 w-4" />
                Table
              </Button>
              <Button
                variant={view === 'tree' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('tree')}
                disabled={loading}
                className={`flex items-center gap-2 ${view === 'tree' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}
              >
                <GitMerge className="h-4 w-4" />
                Graph
              </Button>
              <Button
                variant={view === 'pending-positions' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('pending-positions')}
                disabled={loading}
                className={`flex items-center gap-2 relative ${view === 'pending-positions' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}
              >
                <UserCog className="h-4 w-4" />
                Pending Positions
                {!loading && pendingCount > 0 && (
                  <Badge
                    className="ml-1 h-5 min-w-5 flex items-center justify-center bg-amber-500 text-white border-0 text-xs px-1.5"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            </div>
            <AddUserModal trigger={
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            } />
          </div>
        </div>
      </div>

      {/* Filters - Only show in table view */}
      {view === 'table' && (
        <Card className="professional-card filter-container !rounded-md">
          <CardContent className="p-2">
            <div className="flex items-end gap-2 flex-wrap">
              {/* In Upline */}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  In Upline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={localFilters.inUpline}
                  onValueChange={(value) => setLocalFilters({ inUpline: value })}
                  placeholder="All Agents"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Direct Upline */}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Direct Upline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={localFilters.directUpline}
                  onValueChange={(value) => setLocalFilters({ directUpline: value })}
                  placeholder="All Agents"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* In Downline */}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  In Downline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={localFilters.inDownline}
                  onValueChange={(value) => setLocalFilters({ inDownline: value })}
                  placeholder="All Agents"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Direct Downline */}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Direct Downline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={localFilters.directDownline}
                  onValueChange={(value) => setLocalFilters({ directDownline: value })}
                  placeholder="All Agents"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Agent Name */}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Agent Name
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={localFilters.agentName}
                  onValueChange={(value) => setLocalFilters({ agentName: value })}
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
                  value={localFilters.status}
                  onValueChange={(value) => setLocalFilters({ status: value })}
                  placeholder="All Statuses"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Position */}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Position
                </label>
                <SimpleSearchableSelect
                  options={[{ value: "all", label: "All Positions" }, ...filterPositions.map(p => ({ value: p.position_id, label: p.name }))]}
                  value={localFilters.position}
                  onValueChange={(value) => setLocalFilters({ position: value })}
                  placeholder="All Positions"
                  searchPlaceholder="Search..."
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 items-end">
                <Button
                  onClick={handleApplyFilters}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-4"
                  disabled={loading}
                >
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  Filter
                </Button>
                {(appliedFilters.inUpline !== 'all' || appliedFilters.directUpline !== 'all' || appliedFilters.inDownline !== 'all' || appliedFilters.directDownline !== 'all' || appliedFilters.agentName !== 'all' || appliedFilters.status !== 'all' || appliedFilters.position !== 'all') && (
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
      )}

      {view === 'table' ? (
        <div className="table-container">
          <div className="table-wrapper custom-scrollbar">
            <table className="jira-table min-w-full">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Position</th>
                  <th>Upline</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Downlines</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton loaders for table rows
                  Array.from({ length: 10 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-muted" />
                          <div className="space-y-2">
                            <div className="h-4 w-24 bg-muted rounded" />
                            <div className="h-3 w-32 bg-muted rounded" />
                          </div>
                        </div>
                      </td>
                      <td><div className="h-5 w-20 bg-muted rounded" /></td>
                      <td><div className="h-4 w-24 bg-muted rounded" /></td>
                      <td><div className="h-5 w-16 bg-muted rounded" /></td>
                      <td><div className="h-4 w-20 bg-muted rounded" /></td>
                      <td><div className="h-4 w-20 bg-muted rounded" /></td>
                      <td><div className="h-4 w-12 bg-muted rounded" /></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-destructive">
                      Error: {error}
                    </td>
                  </tr>
                ) : agentsData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No agents found matching your criteria
                    </td>
                  </tr>
                ) : (
                  agentsData.map((agent: Agent) => (
                    <tr key={agent.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full ${badgeColors[agent.badge] || 'bg-muted text-muted-foreground'} flex items-center justify-center text-xs font-bold border`}>
                              {agent.badge.charAt(0)}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{agent.name}</div>
                            <Badge
                              className={`mt-1 ${badgeColors[agent.badge] || 'bg-muted text-muted-foreground border-border'} border`}
                              variant="outline"
                            >
                              {agent.badge}
                            </Badge>
                            {(agent.status === 'invited' || agent.status === 'onboarding') && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleResendInvite(agent.id)
                                }}
                                disabled={resendingInviteId === agent.id}
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-7 px-2 text-xs gap-1"
                              >
                                <Mail className="h-3 w-3" />
                                {resendingInviteId === agent.id ? 'Sending...' : 'Resend Invite'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {agent.position_name ? (
                          <Badge
                            className="bg-blue-500/20 text-blue-400 border-blue-500/30 border"
                            variant="outline"
                          >
                            {agent.position_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not Set</span>
                        )}
                      </td>
                      <td>{formatUplineLabel(agent.upline)}</td>
                      <td>
                        <Badge
                          className={`border ${statusColors[agent.status] || 'bg-muted text-muted-foreground border-border'}`}
                          variant="outline"
                        >
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1).replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground">{agent.created}</td>
                      <td className="text-muted-foreground">{agent.lastLogin}</td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{agent.downlines}</span>
                          {agent.downlines > 0 && (
                            <Button variant="ghost" size="sm">
                              <Users className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Card className="professional-card border-t-0 rounded-t-none">

            {/* Pagination */}
            <div className="flex items-center justify-between py-4 border-t border-border px-6">
              {loading ? (
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} agents
                </div>
              )}
              <div className="flex items-center space-x-2">
                {loading ? (
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
                      className={currentPage === pageNum ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
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
      ) : view === 'tree' ? (
        <div
          className="w-full"
          style={{
            height: 'calc(100vh - 120px)',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}
          ref={containerRef}
        >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="h-64 w-64 mx-auto bg-muted animate-pulse rounded-lg mb-4" />
                  <div className="h-4 w-32 bg-muted animate-pulse rounded mx-auto" />
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-destructive">Error: {error}</div>
              </div>
            ) : treeData ? (
                <Tree
                    data={treeData}
                    translate={translate}
                    orientation="vertical"
                    renderCustomNodeElement={(rd3tProps) =>
                        renderForeignObjectNode({ ...rd3tProps, foreignObjectProps })
                    }
                    nodeSize={nodeSize}
                    pathClassFunc={() => "tree-path-light"}
                    collapsible={true}
                    initialDepth={Infinity}
                    />
            ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-center">No agent data to display in tree view.</p>
                </div>
            )}
        </div>
      ) : (
        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Agents Without Positions</span>
              {loading ? (
                <div className="h-5 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <Badge className="bg-amber-500 text-white border-0">
                  {pendingCount} Pending
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              // Skeleton loaders for pending positions
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border border-border rounded-lg animate-pulse"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-32 bg-muted rounded" />
                      <div className="h-4 w-48 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="h-10 w-48 bg-muted rounded" />
                      <div className="h-10 w-32 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingAgents.length === 0 ? (
              <div className="py-12 text-center">
                <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  All agents have positions assigned!
                </p>
                <p className="text-sm text-muted-foreground">
                  There are no agents waiting for position assignment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  The following agents need position assignments. Select a position for each agent and click Assign.
                </p>
                {pendingAgents.map((agent) => (
                  <div
                    key={agent.agent_id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {agent.first_name} {agent.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {agent.email} {agent.phone_number && `• ${agent.phone_number}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Upline: {formatUplineLabel(agent.upline_name)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created: {new Date(agent.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <SimpleSearchableSelect
                        options={positions
                          .filter(p => p.is_active)
                          .sort((a, b) => b.level - a.level)
                          .map(p => ({
                            value: p.position_id,
                            label: `${p.name} (Level ${p.level})`
                          }))}
                        value={assigningAgentId === agent.agent_id ? selectedPositionId : ""}
                        onValueChange={(value) => {
                          setAssigningAgentId(agent.agent_id)
                          setSelectedPositionId(value)
                        }}
                        placeholder="Select position..."
                        searchPlaceholder="Search positions..."
                      />
                      <Button
                        onClick={() => handleAssignPosition(agent.agent_id, selectedPositionId)}
                        disabled={assigningAgentId !== agent.agent_id || !selectedPositionId}
                        className="bg-foreground hover:bg-foreground/90 text-background"
                        size="sm"
                      >
                        {assigningAgentId === agent.agent_id && selectedPositionId ? 'Assign' : 'Select Position'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
