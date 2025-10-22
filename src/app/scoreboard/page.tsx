"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Award } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/providers/AuthProvider"

interface AgentScore {
  rank: number
  agent_id: string
  name: string
  total: number
  dailyBreakdown: { [date: string]: number }
  dealCount: number
}

interface ScoreboardData {
  leaderboard: AgentScore[]
  stats: {
    totalProduction: number
    totalDeals: number
    activeAgents: number
  }
  dateRange: {
    startDate: string
    endDate: string
  }
}

export default function Scoreboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ScoreboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchScoreboardData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/scoreboard')

        if (!response.ok) {
          throw new Error('Failed to fetch scoreboard data')
        }

        const result = await response.json()

        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to load scoreboard')
        }
      } catch (err) {
        console.error('Error fetching scoreboard:', err)
        setError('Failed to load scoreboard data')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchScoreboardData()
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading scoreboard...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-destructive">{error || 'No data available'}</div>
      </div>
    )
  }

  const topAgents = data.leaderboard.slice(0, 3)

  // Get all unique dates from the leaderboard for column headers
  const allDates = new Set<string>()
  data.leaderboard.forEach(agent => {
    Object.keys(agent.dailyBreakdown).forEach(date => allDates.add(date))
  })
  const sortedDates = Array.from(allDates).sort()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient mb-2">Scoreboard</h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>This Week</span>
            <span>•</span>
            <span>{formatDateRange(data.dateRange.startDate, data.dateRange.endDate)}</span>
          </div>
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Production</h3>
            <p className="text-3xl font-bold text-primary">{formatCurrency(data.stats.totalProduction)}</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Policies Sold</h3>
            <p className="text-3xl font-bold text-green-400">{data.stats.totalDeals}</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Agents</h3>
            <p className="text-3xl font-bold text-blue-400">{data.stats.activeAgents}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Winners */}
      {topAgents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topAgents.map((agent, index) => (
            <Card key={agent.agent_id} className="professional-card relative overflow-hidden">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  <span className="text-4xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{agent.name}</h3>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(agent.total)}</p>
                <Badge
                  variant="outline"
                  className={`mt-2 ${
                    index === 0 ? 'border-yellow-500 text-yellow-500' :
                    index === 1 ? 'border-gray-400 text-gray-400' :
                    'border-orange-500 text-orange-500'
                  }`}
                >
                  #{agent.rank}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Leaderboard Table */}
      <Card className="professional-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">Production Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {data.leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deals found for this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rank</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                    {sortedDates.map(date => (
                      <th key={date} className="text-center py-3 px-4 font-medium text-muted-foreground">
                        {formatDateHeader(date)}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((agent, index) => (
                    <tr key={agent.agent_id} className={`border-b border-border hover:bg-accent/50 transition-colors ${index < 3 ? 'bg-primary/10' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-foreground">{agent.rank}</span>
                          {index < 3 && (
                            <span className={`text-lg ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-500'}`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{agent.name}</td>
                      {sortedDates.map(date => (
                        <td key={date} className="py-3 px-4 text-center text-foreground">
                          {agent.dailyBreakdown[date]
                            ? formatCurrency(agent.dailyBreakdown[date])
                            : '--'}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right font-bold text-green-400">
                        {formatCurrency(agent.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}