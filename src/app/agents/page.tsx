"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Tree, CustomNodeElementProps } from 'react-d3-tree';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Input } from "@/components/ui/input"
import AddUserModal from "@/components/modals/add-user-modal"
import { AgentDetailsModal } from "@/components/modals/agent-details-modal"
import { Plus, Users, List, GitMerge, Filter, X, ChevronDown, ChevronRight, UserCog, Mail, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { usePersistedFilters } from "@/hooks/usePersistedFilters"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

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
  email?: string | null
  first_name?: string
  last_name?: string
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
  position_id?: string | null
  position_name?: string | null
  has_position?: boolean
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

// Position colors based on hierarchy level (top 10 positions get distinct colors, rest are gray)
const positionLevelColors: string[] = [
  "bg-amber-500/20 text-amber-400 border-amber-500/30",      // Level 1 (highest) - Gold
  "bg-orange-500/20 text-orange-400 border-orange-500/30",   // Level 2 - Orange
  "bg-blue-500/20 text-blue-400 border-blue-500/30",         // Level 3 - Blue
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",         // Level 4 - Cyan
  "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",   // Level 5 - Indigo
  "bg-purple-500/20 text-purple-400 border-purple-500/30",   // Level 6 - Purple
  "bg-violet-500/20 text-violet-400 border-violet-500/30",   // Level 7 - Violet
  "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30", // Level 8 - Fuchsia
  "bg-pink-500/20 text-pink-400 border-pink-500/30",         // Level 9 - Pink
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", // Level 10 - Emerald
]

// This function will be used with the positionColorMap from state
const getPositionColorByLevel = (positionLevel: number | null | undefined, colorMap: Map<number, string>): string => {
  if (positionLevel === null || positionLevel === undefined) {
    return "bg-slate-500/20 text-slate-400 border-slate-500/30"
  }

  // Get color from the map (which is populated based on agency's position ranking)
  return colorMap.get(positionLevel) || "bg-gray-500/20 text-gray-400 border-gray-500/30"
}


const renderForeignObjectNode = ({
  nodeDatum,
  toggleNode,
  foreignObjectProps
}: any) => {
  const hasChildren = nodeDatum.children && nodeDatum.children.length > 0
  const isCollapsed = nodeDatum.__rd3t?.collapsed ?? false
  
  // Check for dark mode using document class - stable, doesn't cause re-renders
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  return (
    <g>
      <foreignObject {...foreignObjectProps}>
        <div style={{
          backgroundColor: isDark ? "hsl(var(--card))" : "#ffffff",
          border: isDark ? "2px solid hsl(var(--border))" : "2px solid #e5e7eb",
          borderRadius: "8px",
          color: isDark ? "hsl(var(--foreground))" : "#111827",
          padding: "16px",
          minWidth: "200px",
          position: "relative",
          boxShadow: isDark ? "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
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
                border: isDark ? "1px solid hsl(var(--border))" : "1px solid #d1d5db",
                borderRadius: "4px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: isDark ? "hsl(var(--muted-foreground))" : "#6b7280",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = isDark ? "hsl(var(--accent))" : "#f3f4f6";
                (e.target as HTMLButtonElement).style.borderColor = isDark ? "hsl(var(--border))" : "#9ca3af";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.target as HTMLButtonElement).style.borderColor = isDark ? "hsl(var(--border))" : "#d1d5db";
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
                backgroundColor: isDark ? "hsl(var(--muted))" : "#f3f4f6",
                border: isDark ? "1px solid hsl(var(--border))" : "1px solid #d1d5db",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "10px",
                fontWeight: "600",
                color: isDark ? "hsl(var(--foreground))" : "#374151",
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
              color: isDark ? "hsl(var(--foreground))" : "#111827",
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
                    color: isDark ? "hsl(var(--muted-foreground))" : "#6b7280",
                    marginBottom: "6px",
                    padding: "2px 0"
                  }}>
                    <span style={{
                      color: isDark ? "hsl(var(--muted-foreground))" : "#9ca3af",
                      fontWeight: "500",
                      textTransform: "capitalize"
                    }}>{label}:</span>
                    <span style={{
                      color: isDark ? "hsl(var(--foreground))" : "#374151",
                      fontWeight: "600"
                    }}>{String(value)}</span>
                  </div>
                ))}
            </div>

            {/* Modern Add Agent Button */}
            <div style={{ display: 'flex', justifyContent: 'center'}}>
                <AddUserModal trigger={
                    <button style={{
                      backgroundColor: isDark ? "hsl(var(--muted))" : "#f9fafb",
                      color: isDark ? "hsl(var(--foreground))" : "#374151",
                      border: isDark ? "1px solid hsl(var(--border))" : "1px solid #d1d5db",
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
                      (e.target as HTMLButtonElement).style.backgroundColor = isDark ? "hsl(var(--accent))" : "#f3f4f6";
                      (e.target as HTMLButtonElement).style.borderColor = isDark ? "hsl(var(--border))" : "#9ca3af";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = isDark ? "hsl(var(--muted))" : "#f9fafb";
                      (e.target as HTMLButtonElement).style.borderColor = isDark ? "hsl(var(--border))" : "#d1d5db";
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
  const [positionColorMap, setPositionColorMap] = useState<Map<number, string>>(new Map())

  // Pending positions state
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [positions, setPositions] = useState<Position[]>([]) // For pending positions assignment (filtered by user level)
  const [filterPositions, setFilterPositions] = useState<Position[]>([]) // For filter dropdown (all agency positions)
  const [assigningAgentId, setAssigningAgentId] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string>("")
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null) // Track which agent we're working on
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null)
  const [agentToInvite, setAgentToInvite] = useState<Agent | null>(null)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [pendingSearchTerm, setPendingSearchTerm] = useState("")
  const [selectedAgentIdForModal, setSelectedAgentIdForModal] = useState<string | null>(null)
  const [agentModalOpen, setAgentModalOpen] = useState(false)

  // Track which filters are visible (showing input fields) - load from localStorage
  const [visibleFilters, setVisibleFilters] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agents-visible-filters')
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
      localStorage.setItem('agents-visible-filters', JSON.stringify(Array.from(visibleFilters)))
    }
  }, [visibleFilters])

  const formatUplineLabel = (upline?: string | null) => {
    if (!upline) return 'None'
    // Check if upline contains "undefined" (case-insensitive)
    if (upline.toLowerCase().includes('undefined')) {
      return 'None'
    }
    const normalized = upline.replace(/[\s,]/g, '')
    if (!normalized) return 'None'

    // Convert "Last, First" to "First Last"
    if (upline.includes(',')) {
      const parts = upline.split(',').map(p => p.trim())
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`
      }
    }

    return upline
  }

  const formatDate = (dateString?: string | null) => {
    console.log('[formatDate] Input:', dateString, 'Type:', typeof dateString)
    if (!dateString) {
      console.log('[formatDate] No dateString, returning N/A')
      return 'N/A'
    }
    const date = new Date(dateString)
    console.log('[formatDate] Parsed date:', date, 'Is valid:', !isNaN(date.getTime()))
    if (isNaN(date.getTime())) {
      console.log('[formatDate] Invalid date, returning N/A')
      return 'N/A'
    }
    const formatted = date.toLocaleDateString()
    console.log('[formatDate] Formatted:', formatted)
    return formatted
  }

  const formatDateCompact = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'N/A'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // Less than 1 hour ago
    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`
    }

    // Less than 24 hours ago
    if (diffHours < 24) {
      return `${diffHours}h ago`
    }

    // Less than 7 days ago
    if (diffDays < 7) {
      return `${diffDays}d ago`
    }

    // Less than 30 days ago
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks}w ago`
    }

    // Format as MMM DD, YYYY
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  const containerRef = useCallback((containerElem: HTMLDivElement | null) => {
        if (containerElem !== null) {
            const { width, height } = containerElem.getBoundingClientRect();
            setTranslate({ x: width / 2, y: height / 5 });
        }
    }, []);

  // Fetch all positions for the agency and build color map based on rank
  useEffect(() => {
    const fetchPositionsForColorMap = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) return

        // Fetch all positions for the agency
        const response = await fetch('/api/positions', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()

          // Sort positions by level (descending - highest level first)
          const sortedPositions = [...data].sort((a, b) => b.level - a.level)

          // Create a map of level -> color based on rank
          const colorMap = new Map<number, string>()
          sortedPositions.forEach((position, index) => {
            // Top 10 positions get distinct colors, rest get gray
            if (index < 10) {
              colorMap.set(position.level, positionLevelColors[index])
            } else {
              colorMap.set(position.level, "bg-gray-500/20 text-gray-400 border-gray-500/30")
            }
          })

          setPositionColorMap(colorMap)
        }
      } catch (err) {
        console.error('Error fetching positions for color map:', err)
      }
    }

    fetchPositionsForColorMap()
  }, [])

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
          params.append('directUpline', appliedFilters.directUpline === 'not_set' ? 'not_set' : appliedFilters.directUpline)
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
          params.append('positionId', appliedFilters.position === 'not_set' ? 'not_set' : appliedFilters.position)
        }

        const url = `/api/agents?${params.toString()}`
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch agents')
        }
        const data = await response.json()

        if(view === 'table') {
            // For pre-invite agents without email, fetch email from agent details
            const agentsWithEmail = await Promise.all(
              data.agents.map(async (agent: Agent) => {
                if (agent.status?.toLowerCase() === 'pre-invite' && !agent.email) {
                  try {
                    const response = await fetch(`/api/agents/${agent.id}`, {
                      credentials: 'include'
                    })
                    if (response.ok) {
                      const agentData = await response.json()
                      return { ...agent, email: agentData.email || null }
                    }
                  } catch (err) {
                    console.error('Error fetching agent email:', err)
                  }
                }
                return agent
              })
            )

            // Agents are already sorted hierarchically by the database RPC
            setAgentsData(agentsWithEmail)
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

  // Fetch all agents for pending positions view (with and without positions)
  // This loads all data upfront so we can filter client-side without API calls
  useEffect(() => {
    const fetchAllAgents = async () => {
      if (view !== 'pending-positions') return

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          console.error('No access token available')
          return
        }

        // Fetch ALL agents (with and without positions) by using special 'all' parameter
        // This triggers the API's search path which returns all agents (with and without positions)
        const url = new URL('/api/agents/without-positions', window.location.origin)
        url.searchParams.set('all', 'true') // Special parameter to fetch all agents

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[Frontend] Received agents data:', data.agents?.length || 0, 'agents')
          console.log('[Frontend] Sample agent created_at values:', data.agents?.slice(0, 3).map((a: PendingAgent) => ({
            id: a.agent_id,
            name: `${a.first_name} ${a.last_name}`,
            created_at: a.created_at,
            type: typeof a.created_at,
            has_position: a.has_position
          })))
          setPendingAgents(data.agents || [])
          // Count only those without positions for the badge
          const withoutPositionsCount = (data.agents || []).filter((a: PendingAgent) => !a.has_position).length
          setPendingCount(withoutPositionsCount)
        } else {
          console.error('Failed to fetch agents:', response.status, await response.text())
        }
      } catch (err) {
        console.error('Error fetching agents:', err)
      }
    }

    fetchAllAgents()
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
    // Also hide all filter input fields
    setVisibleFilters(new Set())
  }

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
      case 'inUpline':
        setLocalFilters({ inUpline: 'all' })
        break
      case 'directUpline':
        setLocalFilters({ directUpline: 'all' })
        break
      case 'inDownline':
        setLocalFilters({ inDownline: 'all' })
        break
      case 'directDownline':
        setLocalFilters({ directDownline: 'all' })
        break
      case 'agentName':
        setLocalFilters({ agentName: 'all' })
        break
      case 'status':
        setLocalFilters({ status: 'all' })
        break
      case 'position':
        setLocalFilters({ position: 'all' })
        break
    }
  }

  const availableFilters = [
    { id: 'inUpline', label: 'In Upline' },
    { id: 'directUpline', label: 'Direct Upline' },
    { id: 'inDownline', label: 'In Downline' },
    { id: 'directDownline', label: 'Direct Downline' },
    { id: 'agentName', label: 'Agent Name' },
    { id: 'status', label: 'Status' },
    { id: 'position', label: 'Position' },
  ]

  const hasActiveFilters =
    appliedFilters.inUpline !== 'all' ||
    appliedFilters.directUpline !== 'all' ||
    appliedFilters.inDownline !== 'all' ||
    appliedFilters.directDownline !== 'all' ||
    appliedFilters.agentName !== 'all' ||
    appliedFilters.status !== 'all' ||
    appliedFilters.position !== 'all'

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

      // Refresh the agents list to get updated position information
      // Fetch all agents again (with and without positions)
      const refreshUrl = new URL('/api/agents/without-positions', window.location.origin)
      refreshUrl.searchParams.set('all', 'true') // Special parameter to fetch all agents

      const refreshResponse = await fetch(refreshUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setPendingAgents(refreshData.agents || [])
        setPendingCount(refreshData.count || 0)
      }

      // Clear selection state after successful assignment
      setSelectedPositionId("")
      setSelectedAgentId(null)
      setAssigningAgentId(null)

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

  // Handle send invite for pre-invite users
  const handleSendInvite = async (agent: Agent) => {
    if (!agent.email) {
      alert('Agent email is required to send invitation')
      return
    }

    setAgentToInvite(agent)
    setSendingInvite(true)
    
    try {
      // Get the agent's name parts
      const firstName = agent.first_name || agent.name.split(' ')[0] || ''
      const lastName = agent.last_name || agent.name.split(' ').slice(1).join(' ') || ''

      // Determine permission level from role (default to agent)
      const permissionLevel = 'agent'

      const response = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: agent.email,
          firstName: firstName,
          lastName: lastName,
          phoneNumber: null,
          permissionLevel: permissionLevel,
          uplineAgentId: null,
          positionId: agent.position_id || null,
          preInviteUserId: agent.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send invitation')
      }

      // Refresh the agents list
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
        params.append('directUpline', appliedFilters.directUpline === 'not_set' ? 'not_set' : appliedFilters.directUpline)
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
        params.append('positionId', appliedFilters.position === 'not_set' ? 'not_set' : appliedFilters.position)
      }

      const url = `/api/agents?${params.toString()}`
      const refreshResponse = await fetch(url)
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        if (view === 'table') {
          setAgentsData(refreshData.agents)
          setTotalPages(refreshData.pagination.totalPages)
          setTotalCount(refreshData.pagination.totalCount)
          if (refreshData.allAgents) {
            setAllAgents(refreshData.allAgents)
          }
        }
      }
      
      alert('Invitation sent successfully!')
    } catch (err) {
      console.error('Error sending invite:', err)
      alert(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setSendingInvite(false)
      setAgentToInvite(null)
    }
  }

  // Handle row click to open modal
  const handleRowClick = (agent: Agent) => {
    // Console.log the full agent object
    console.log('Agent object:', agent)
    
    // Open modal with agent details
    setSelectedAgentIdForModal(agent.id)
    setAgentModalOpen(true)
  }

  const handleAgentModalClose = () => {
    setAgentModalOpen(false)
    setSelectedAgentIdForModal(null)
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

  // Generate direct upline options with "Not Set" option
  const directUplineOptions = [
    { value: "all", label: "All Agents" },
    { value: "not_set", label: "Not Set" },
    ...allAgents.map(agent => ({ value: agent.name, label: agent.name }))
  ]

  // Generate position options with "Not Set" option
  const positionOptions = [
    { value: "all", label: "All Positions" },
    { value: "not_set", label: "Not Set" },
    ...filterPositions.map(p => ({ value: p.position_id, label: p.name }))
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

  // Filter agents client-side based on search term (all data is already loaded)
  const normalizedPendingSearch = pendingSearchTerm.trim().toLowerCase()
  const visiblePendingAgents = normalizedPendingSearch
    ? pendingAgents.filter((agent) => {
        const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase()
        const email = (agent.email || "").toLowerCase()
        return fullName.includes(normalizedPendingSearch) || email.includes(normalizedPendingSearch)
      })
    : pendingAgents

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
        <Card className="professional-card !rounded-md overflow-visible">
          <CardContent className="p-4 overflow-visible">
            <div className="space-y-4">
              {/* Add Filter Button and Active Filters */}
              <div className="flex items-center gap-2 flex-wrap overflow-visible">
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
                {visibleFilters.has('inUpline') && (
                  <Badge variant="outline" className="h-8 px-3">
                    In Upline
                    <X
                      className="h-3 w-3 ml-2 cursor-pointer"
                      onClick={() => removeFilter('inUpline')}
                    />
                  </Badge>
                )}
                {visibleFilters.has('directUpline') && (
                  <Badge variant="outline" className="h-8 px-3">
                    Direct Upline
                    <X
                      className="h-3 w-3 ml-2 cursor-pointer"
                      onClick={() => removeFilter('directUpline')}
                    />
                  </Badge>
                )}
                {visibleFilters.has('inDownline') && (
                  <Badge variant="outline" className="h-8 px-3">
                    In Downline
                    <X
                      className="h-3 w-3 ml-2 cursor-pointer"
                      onClick={() => removeFilter('inDownline')}
                    />
                  </Badge>
                )}
                {visibleFilters.has('directDownline') && (
                  <Badge variant="outline" className="h-8 px-3">
                    Direct Downline
                    <X
                      className="h-3 w-3 ml-2 cursor-pointer"
                      onClick={() => removeFilter('directDownline')}
                    />
                  </Badge>
                )}
                {visibleFilters.has('agentName') && (
                  <Badge variant="outline" className="h-8 px-3">
                    Agent Name
                    <X
                      className="h-3 w-3 ml-2 cursor-pointer"
                      onClick={() => removeFilter('agentName')}
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
                {visibleFilters.has('position') && (
                  <Badge variant="outline" className="h-8 px-3">
                    Position
                    <X
                      className="h-3 w-3 ml-2 cursor-pointer"
                      onClick={() => removeFilter('position')}
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
                  {visibleFilters.has('inUpline') && (
                    <div className="relative overflow-visible">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">
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
                  )}

                  {visibleFilters.has('directUpline') && (
                    <div className="relative overflow-visible">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                        Direct Upline
                      </label>
                      <SimpleSearchableSelect
                        options={directUplineOptions}
                        value={localFilters.directUpline}
                        onValueChange={(value) => setLocalFilters({ directUpline: value })}
                        placeholder="All Agents"
                        searchPlaceholder="Search..."
                      />
                    </div>
                  )}

                  {visibleFilters.has('inDownline') && (
                    <div className="relative overflow-visible">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">
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
                  )}

                  {visibleFilters.has('directDownline') && (
                    <div className="relative overflow-visible">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">
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
                  )}

                  {visibleFilters.has('agentName') && (
                    <div className="relative overflow-visible">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">
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
                  )}

                  {visibleFilters.has('status') && (
                    <div className="relative overflow-visible">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">
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
                  )}

                  {visibleFilters.has('position') && (
                    <div className="relative overflow-visible">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                        Position
                      </label>
                      <SimpleSearchableSelect
                        options={positionOptions}
                        value={localFilters.position}
                        onValueChange={(value) => setLocalFilters({ position: value })}
                        placeholder="All Positions"
                        searchPlaceholder="Search..."
                      />
                    </div>
                  )}
                </div>
              )}
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
                  <th className="text-xs uppercase tracking-wider">Agent</th>
                  <th className="text-xs uppercase tracking-wider">Position</th>
                  <th className="text-xs uppercase tracking-wider">Upline</th>
                  <th className="text-xs uppercase tracking-wider">Status</th>
                  <th className="text-xs uppercase tracking-wider">Created</th>
                  <th className="text-xs uppercase tracking-wider">Last Login</th>
                  <th className="text-xs uppercase tracking-wider">Downlines</th>
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
                    <tr 
                      key={agent.id} 
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleRowClick(agent)}
                    >
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`w-9 h-9 rounded-full ${badgeColors[agent.badge] || 'bg-muted text-muted-foreground'} flex items-center justify-center text-xs font-bold border-2 shadow-sm`}>
                              {agent.name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('')}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-lg text-foreground">{agent.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                className={`${
                                  agent.badge.toLowerCase().includes('admin')
                                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                    : agent.badge.toLowerCase().includes('ega') || agent.badge.toLowerCase().includes('efo') || agent.badge.toLowerCase().includes('ejo')
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : 'bg-green-500/20 text-green-400 border-green-500/30'
                                } border text-xs font-semibold`}
                                variant="outline"
                              >
                                {agent.badge}
                              </Badge>
                            </div>
                            <div className="mt-2">
                              {agent.status?.toLowerCase() === 'pre-invite' && agent.email && (
                                <Button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    // Fetch full agent details if needed
                                    let agentWithEmail = agent
                                    if (!agent.first_name || !agent.last_name) {
                                      try {
                                        const response = await fetch(`/api/agents/${agent.id}`, {
                                          credentials: 'include'
                                        })
                                        if (response.ok) {
                                          const agentData = await response.json()
                                          const nameParts = agentData.name.split(' ')
                                          agentWithEmail = { 
                                            ...agent, 
                                            email: agentData.email || agent.email,
                                            first_name: agentData.name.split(',')[1]?.trim() || nameParts[0] || '',
                                            last_name: agentData.name.split(',')[0]?.trim() || nameParts.slice(1).join(' ') || ''
                                          }
                                        }
                                      } catch (err) {
                                        console.error('Error fetching agent details:', err)
                                      }
                                    }
                                    await handleSendInvite(agentWithEmail)
                                  }}
                                  disabled={sendingInvite && agentToInvite?.id === agent.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-3 text-xs gap-1.5 bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 hover:border-blue-500/40"
                                >
                                  <Send className="h-3 w-3" />
                                  {sendingInvite && agentToInvite?.id === agent.id ? 'Sending...' : 'Send Invitation'}
                                </Button>
                              )}
                              {(agent.status?.toLowerCase() === 'invited' || agent.status?.toLowerCase() === 'onboarding') && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleResendInvite(agent.id)
                                  }}
                                  disabled={resendingInviteId === agent.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-3 text-xs gap-1.5 bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 hover:border-blue-500/40"
                                >
                                  <Mail className="h-3 w-3" />
                                  {resendingInviteId === agent.id ? 'Sending...' : 'Resend Invite'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {agent.position_name ? (
                          <Badge
                            className={`${getPositionColorByLevel(agent.position_level, positionColorMap)} border font-semibold text-xs`}
                            variant="outline"
                          >
                            {agent.position_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">Not Set</span>
                        )}
                      </td>
                      <td>
                        <span className={`text-base ${formatUplineLabel(agent.upline) === 'None' ? 'text-muted-foreground italic' : 'text-foreground font-semibold'}`}>
                          {formatUplineLabel(agent.upline)}
                        </span>
                      </td>
                      <td>
                        <Badge
                          className={`border font-semibold text-xs ${statusColors[agent.status] || 'bg-muted text-muted-foreground border-border'}`}
                          variant="outline"
                        >
                          {agent.status
                            .split('-')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join('-')}
                        </Badge>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div className="text-foreground font-medium">{formatDateCompact(agent.created)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {agent.created && agent.created !== 'N/A' && new Date(agent.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div className="text-foreground font-medium">{formatDateCompact(agent.lastLogin)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {agent.lastLogin && agent.lastLogin !== 'N/A' && new Date(agent.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center gap-1.5">
                            <Users className={`h-4 w-4 ${agent.downlines > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={`font-semibold text-sm ${agent.downlines > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {agent.downlines}
                            </span>
                          </div>
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
          className="w-full bg-background dark:bg-card"
          style={{
            height: 'calc(100vh - 120px)',
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
                    pathClassFunc={() => {
                      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                      return isDark ? "tree-path" : "tree-path-light"
                    }}
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
            ) : (
              <div className="space-y-4">
                <div className="space-y-4 mb-6">
                  <p className="text-sm text-muted-foreground">
                    {visiblePendingAgents.length === 0 && pendingSearchTerm
                      ? "No agents match your search."
                      : pendingSearchTerm
                      ? "Search results: You can assign or update positions for any agent shown below."
                      : "The following agents need position assignments. Select a position for each agent and click Assign. Use the search bar to find and modify positions for agents who already have positions."}
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">
                      Search Agents
                    </label>
                    <Input
                      type="text"
                      value={pendingSearchTerm}
                      onChange={(e) => {
                        const value = e.target.value
                        setPendingSearchTerm(value)
                        // Reset selection state when search is cleared
                        if (!value) {
                          setSelectedAgentId(null)
                          setSelectedPositionId("")
                          setAssigningAgentId(null)
                        }
                      }}
                      placeholder="Search by name or email to find and modify agent positions..."
                      className="h-11 text-sm"
                    />
                  </div>
                </div>
                {visiblePendingAgents.length === 0 && !pendingSearchTerm ? (
                  <div className="py-12 text-center">
                    <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      All agents have positions assigned!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      There are no agents waiting for position assignment.
                    </p>
                  </div>
                ) : visiblePendingAgents.length === 0 && pendingSearchTerm ? (
                  <div className="py-12 text-center">
                    <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      No agents match your search.
                    </p>
                  </div>
                ) : (
                  <>
                    {visiblePendingAgents.map((agent) => (
                  <div
                    key={agent.agent_id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-foreground">
                          {agent.first_name} {agent.last_name}
                        </div>
                        {agent.has_position && agent.position_name && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                            Current: {agent.position_name}
                          </Badge>
                        )}
                        {!agent.has_position && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                            No Position
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {agent.email} {agent.phone_number && `• ${agent.phone_number}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Upline: {formatUplineLabel(agent.upline_name)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created: {(() => {
                          console.log('[Agent Display] Agent:', agent.agent_id, 'created_at:', agent.created_at, 'Type:', typeof agent.created_at)
                          return formatDate(agent.created_at)
                        })()}
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
                        value={selectedAgentId === agent.agent_id ? (selectedPositionId || agent.position_id || "") : (agent.position_id || "")}
                        onValueChange={(value) => {
                          setSelectedAgentId(agent.agent_id)
                          setSelectedPositionId(value)
                        }}
                        placeholder={agent.position_name ? `Current: ${agent.position_name}` : "Select position..."}
                        searchPlaceholder="Search positions..."
                      />
                      <Button
                        onClick={() => {
                          // Prevent clicks if currently assigning
                          if (assigningAgentId === agent.agent_id) {
                            return
                          }
                          
                          // Must be working on this agent and have a selected position
                          if (selectedAgentId !== agent.agent_id || !selectedPositionId) {
                            return
                          }
                          
                          // If agent has position, only allow if the selected position is different
                          if (agent.has_position && selectedPositionId === agent.position_id) {
                            return
                          }
                          
                          handleAssignPosition(agent.agent_id, selectedPositionId)
                        }}
                        disabled={
                          // Disable if currently assigning this agent
                          assigningAgentId === agent.agent_id ||
                          // For agents with position: enable only if working on this agent AND selected a DIFFERENT position
                          (agent.has_position && (
                            selectedAgentId !== agent.agent_id || 
                            !selectedPositionId || 
                            selectedPositionId === agent.position_id
                          )) ||
                          // For agents without position: enable only if working on this agent AND selected a position
                          (!agent.has_position && (
                            selectedAgentId !== agent.agent_id || 
                            !selectedPositionId
                          ))
                        }
                        className="bg-foreground hover:bg-foreground/90 text-background disabled:opacity-50 disabled:cursor-not-allowed"
                        size="sm"
                      >
                        {assigningAgentId === agent.agent_id
                          ? 'Assigning...'
                          : agent.has_position && selectedAgentId === agent.agent_id && selectedPositionId && selectedPositionId !== agent.position_id
                          ? 'Update Position'
                          : !agent.has_position && selectedAgentId === agent.agent_id && selectedPositionId
                          ? 'Assign Position'
                          : 'Select Position'}
                      </Button>
                    </div>
                  </div>
                ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Agent Details Modal */}
      {selectedAgentIdForModal && (
        <AgentDetailsModal
          open={agentModalOpen}
          onOpenChange={handleAgentModalClose}
          agentId={selectedAgentIdForModal}
          onUpdate={() => {
            // Refresh agents data if needed
            const fetchAgents = async () => {
              try {
                setLoading(true)
                const params = new URLSearchParams()
                if (view === 'table') {
                  params.append('page', currentPage.toString())
                  params.append('limit', '20')
                } else {
                  params.append('view', 'tree')
                }

                if (appliedFilters.inUpline && appliedFilters.inUpline !== 'all') {
                  params.append('inUpline', appliedFilters.inUpline)
                }
                if (appliedFilters.directUpline && appliedFilters.directUpline !== 'all') {
                  params.append('directUpline', appliedFilters.directUpline === 'not_set' ? 'not_set' : appliedFilters.directUpline)
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
                  params.append('positionId', appliedFilters.position === 'not_set' ? 'not_set' : appliedFilters.position)
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
          }}
        />
      )}

    </div>
  )
}

