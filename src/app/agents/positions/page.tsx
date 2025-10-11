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
import CreatePositionModal from "@/components/modals/create-position-modal"
import ImportCommissionModal from "@/components/modals/import-commission-modal"
import { Edit, Trash2 } from "lucide-react"

// Position data type
interface Position {
  id: string
  user: string
  position: string
  upline: string
  start: string
}

export default function AgentPositions() {
  const [selectedUser, setSelectedUser] = useState("all")
  const [positionsData, setPositionsData] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Fetch positions data from API
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/positions/users?page=${currentPage}&limit=20`)
        if (!response.ok) {
          throw new Error('Failed to fetch positions')
        }
        const data = await response.json()
        setPositionsData(data.users)
        setTotalPages(data.pagination.totalPages)
        setTotalCount(data.pagination.totalCount)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Error fetching positions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPositions()
  }, [currentPage])

  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading positions...</div>
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
          <h1 className="text-4xl font-bold text-gradient">Positions</h1>
          <div className="flex items-center space-x-4">
            <CreatePositionModal trigger={
              <Button className="btn-gradient" size="sm">
                New Position +
              </Button>
            } />
            <ImportCommissionModal trigger={
              <Button className="btn-gradient" size="sm">
                Import +
              </Button>
            } />
            <Button className="btn-gradient" size="sm">
              Export +
            </Button>
          </div>
        </div>
      </div>

      {/* User Filter */}
      <Card className="professional-card filter-container">
        <CardContent className="p-4">
          <div className="w-64">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              User
            </label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select an Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Select an Agent</SelectItem>
                <SelectItem value="Diamond Financial Group">Diamond Financial Group</SelectItem>
                <SelectItem value="Abdellatif, Rammy">Abdellatif, Rammy</SelectItem>
                <SelectItem value="Abernethy, Adam">Abernethy, Adam</SelectItem>
                <SelectItem value="Accetta, Jackson">Accetta, Jackson</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Positions Table */}
      <Card className="professional-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">User</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Position</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Upline</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Start</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positionsData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-center text-muted-foreground">
                      No positions found
                    </td>
                  </tr>
                ) : (
                  positionsData.map((position: Position) => (
                    <tr key={position.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                      <td className="py-4 px-6 text-foreground">{position.user}</td>
                      <td className="py-4 px-6 text-foreground">{position.position}</td>
                      <td className="py-4 px-6 text-foreground">{position.upline}</td>
                      <td className="py-4 px-6 text-foreground">{position.start}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between py-4 border-t border-border px-6">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} positions
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
        </CardContent>
      </Card>
    </div>
  )
}