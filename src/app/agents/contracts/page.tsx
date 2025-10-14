"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

// Contract data type
interface Contract {
  id: string
  carrier: string
  agent: string
  loa: string
  status: string
  startDate: string
  agentNumber: string
}

export default function AgentContracts() {
  const [selectedCarrier, setSelectedCarrier] = useState("all")
  const [agentSearch, setAgentSearch] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedLOA, setSelectedLOA] = useState("all")
  const [contractsData, setContractsData] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Fetch contracts data from API
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/contracts?page=${currentPage}&limit=20`)
        if (!response.ok) {
          throw new Error('Failed to fetch contracts')
        }
        const data = await response.json()
        setContractsData(data.contracts)
        setTotalPages(data.pagination.totalPages)
        setTotalCount(data.pagination.totalCount)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Error fetching contracts:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchContracts()
  }, [currentPage])

  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading contracts...</div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">Error: {error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold text-gradient">Contracts</h1>
          <Button className="btn-gradient" size="sm">
            Add Contract +
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="professional-card filter-container">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                Carrier
              </label>
              <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select a Carrier</SelectItem>
                  <SelectItem value="Aetna">Aetna</SelectItem>
                  <SelectItem value="American Amicable">American Amicable</SelectItem>
                  <SelectItem value="Aflac">Aflac</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                Agent #
              </label>
              <Input
                type="text"
                placeholder="Search by Agent #"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                Agent Name
              </label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select an Agent</SelectItem>
                  <SelectItem value="Accetta, Jackson">Accetta, Jackson</SelectItem>
                  <SelectItem value="Adams, Cody">Adams, Cody</SelectItem>
                  <SelectItem value="Adler, Ari">Adler, Ari</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                LOA Contract
              </label>
              <Select value={selectedLOA} onValueChange={setSelectedLOA}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an LOA Contract" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select an LOA Contract</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Schwartz">Schwartz, Joseph</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3">
            <Button variant="outline" size="sm">
              Add Contract +
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <div className="table-container">
        <div className="table-wrapper custom-scrollbar">
          <table className="jira-table min-w-full">
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Agent</th>
                <th>LOA</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>Agent #</th>
              </tr>
            </thead>
            <tbody>
              {contractsData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No contracts found
                  </td>
                </tr>
              ) : (
                contractsData.map((contract: Contract) => (
                  <tr key={contract.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <td>{contract.carrier}</td>
                    <td>{contract.agent}</td>
                    <td>{contract.loa}</td>
                    <td>{contract.status}</td>
                    <td>{contract.startDate}</td>
                    <td>{contract.agentNumber}</td>
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
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} contracts
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