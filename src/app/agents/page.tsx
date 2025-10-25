"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Tree, CustomNodeElementProps } from 'react-d3-tree';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import AddUserModal from "@/components/modals/add-user-modal"
import { Search, Filter, Plus, MoreHorizontal, Users, List, GitMerge } from "lucide-react"

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
}

interface TreeNode {
    name: string;
    attributes?: {
      [key: string]: string;
    };
    children?: TreeNode[];
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

// Generate dynamic options from fetched data
const generateAgentOptions = (agents: Agent[]) => {
  const options = [{ value: "all", label: "All Agents" }]
  agents.forEach(agent => {
    options.push({ value: agent.name, label: agent.name })
  })
  return options
}

const generatePositionOptions = (agents: Agent[]) => {
  const positions = new Set(agents.map(agent => agent.position))
  const options = [{ value: "all", label: "All Positions" }]
  positions.forEach(position => {
    options.push({ value: position, label: position })
  })
  return options
}

const renderForeignObjectNode = ({
  nodeDatum,
  toggleNode,
  foreignObjectProps,
  handleNodeClick
}: any) => (
  <g>
    {/* Clean, modern look without gradients */}
    {/* `foreignObject` requires width & height to be explicitly set. */}
    <foreignObject {...foreignObjectProps}>
      <div style={{
        backgroundColor: "#374151",
        border: "3px solid #6b7280",
        borderRadius: "8px",
        color: "#f9fafb",
        padding: "16px",
        minWidth: "200px",
        position: "relative"
      }}>

        {/* Header with position badge */}
        <div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "12px"
          }}>
            <div style={{
              backgroundColor: "#1f2937",
              border: "2px solid #4b5563",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10px",
              fontWeight: "600",
              color: "#e5e7eb",
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
            color: "#ffffff",
            letterSpacing: "0.025em",
            lineHeight: "1.2"
          }}>{nodeDatum.name}</h3>

          {/* Attributes in a cleaner layout */}
          <div style={{ marginBottom: "16px" }}>
            {nodeDatum.attributes &&
              Object.entries(nodeDatum.attributes)
                .filter(([label]) => label !== "position") // Don't show position twice
                .map(([label, value], index) => (
                <div key={`${label}-${index}`} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                  padding: "2px 0"
                }}>
                  <span style={{
                    color: "#94a3b8",
                    fontWeight: "500",
                    textTransform: "capitalize"
                  }}>{label}:</span>
                  <span style={{
                    color: "#f1f5f9",
                    fontWeight: "600"
                  }}>{String(value)}</span>
                </div>
              ))}
          </div>

          {/* Modern Add Agent Button */}
          <div style={{ display: 'flex', justifyContent: 'center'}}>
              <AddUserModal trigger={
                  <button style={{
                    backgroundColor: "#1f2937",
                    color: "#e5e7eb",
                    border: "2px solid #4b5563",
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
                    (e.target as HTMLButtonElement).style.backgroundColor = "#111827";
                    (e.target as HTMLButtonElement).style.borderColor = "#6b7280";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = "#1f2937";
                    (e.target as HTMLButtonElement).style.borderColor = "#4b5563";
                  }}>
                      <span style={{ fontSize: "14px" }}>+</span> Add Agent
                  </button>
              } upline={nodeDatum.name} />
          </div>
        </div>
      </div>
    </foreignObject>
  </g>
);


export default function Agents() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedPosition, setSelectedPosition] = useState("all")
  const [selectedDirectUpline, setSelectedDirectUpline] = useState("all")
  const [selectedInDownline, setSelectedInDownline] = useState("all")
  const [selectedDirectDownline, setSelectedDirectDownline] = useState("all")
  const [selectedAgentName, setSelectedAgentName] = useState("all")
  const [agentsData, setAgentsData] = useState<Agent[]>([])
  const [treeData, setTreeData] = useState<TreeNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [view, setView] = useState<'table' | 'tree'>('table')
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

    const containerRef = useCallback((containerElem: HTMLDivElement | null) => {
        if (containerElem !== null) {
            const { width, height } = containerElem.getBoundingClientRect();
            setTranslate({ x: width / 2, y: height / 5 });
        }
    }, []);

  // Fetch agents data from API
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true)
        const url = view === 'table' ? `/api/agents?page=${currentPage}&limit=20` : '/api/agents?view=tree'
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch agents')
        }
        const data = await response.json()

        if(view === 'table') {
            setAgentsData(data.agents)
            setTotalPages(data.pagination.totalPages)
            setTotalCount(data.pagination.totalCount)
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
  }, [currentPage, view])

  const filteredAgents = agentsData.filter((agent: Agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedAgent === "all" || agent.upline === selectedAgent) &&
    (selectedPosition === "all" || agent.position === selectedPosition)
  )

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading agents...</div>
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

  const agentOptions = generateAgentOptions(agentsData)
  const positionOptions = generatePositionOptions(agentsData)
  const nodeSize = { x: 220, y: 200 };
  const foreignObjectProps = { width: nodeSize.x, height: nodeSize.y, x: -110, y: 10 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold text-gradient">Agents</h1>
          <div className="flex items-center space-x-4">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setView(view === 'table' ? 'tree' : 'table')}
                className="flex items-center gap-2"
            >
                {view === 'table' ? (
                  <>
                    <GitMerge className="h-4 w-4" />
                    Graph View
                  </>
                ) : (
                  <>
                    <List className="h-4 w-4" />
                    List View
                  </>
                )}
            </Button>
            <AddUserModal trigger={
              <Button className="btn-gradient" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            } />
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
                placeholder="Search agents by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            {/* First Row - Primary Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {/* In Upline */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  In Upline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={selectedAgent}
                  onValueChange={setSelectedAgent}
                  placeholder="All Agents"
                  searchPlaceholder="Search agents..."
                />
              </div>

              {/* Direct Upline */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Direct Upline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={selectedDirectUpline}
                  onValueChange={setSelectedDirectUpline}
                  placeholder="Select an Agent"
                  searchPlaceholder="Search agents..."
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Position
                </label>
                <SimpleSearchableSelect
                  options={positionOptions}
                  value={selectedPosition}
                  onValueChange={setSelectedPosition}
                  placeholder="All Positions"
                  searchPlaceholder="Search positions..."
                />
              </div>

              {/* In Downline */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  In Downline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={selectedInDownline}
                  onValueChange={setSelectedInDownline}
                  placeholder="Select an Agent"
                  searchPlaceholder="Search agents..."
                />
              </div>
            </div>

            {/* Second Row - Additional Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-2">
              {/* Direct Downline */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Direct Downline
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={selectedDirectDownline}
                  onValueChange={setSelectedDirectDownline}
                  placeholder="Select an Agent"
                  searchPlaceholder="Search agents..."
                />
              </div>

              {/* Agent Name */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                  Agent Name
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={selectedAgentName}
                  onValueChange={setSelectedAgentName}
                  placeholder="Select an Agent"
                  searchPlaceholder="Search agents..."
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {view === 'table' ? (
        <div className="table-container">
          <div className="table-wrapper custom-scrollbar">
            <table className="jira-table min-w-full">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Upline</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Downlines</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No agents found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent: Agent) => (
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
                          </div>
                        </div>
                      </td>
                      <td>{agent.upline}</td>
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
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} agents
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
      ) : (
        <Card className="professional-card">
            <CardContent className="p-4" style={{
              height: '600px',
              backgroundColor: '#1f2937'
            }} ref={containerRef}>
                {treeData ? (
                    <Tree
                        data={treeData}
                        translate={translate}
                        orientation="vertical"
                        renderCustomNodeElement={(rd3tProps) =>
                            renderForeignObjectNode({ ...rd3tProps, foreignObjectProps })
                        }
                        nodeSize={nodeSize}
                        pathClassFunc={() => "tree-path"}
                        />
                ) : (
                    <p className="text-muted-foreground text-center">No agent data to display in tree view.</p>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  )
}
