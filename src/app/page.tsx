"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BarChart3 } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"
import OnboardingWizard from "@/components/onboarding-wizard"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [firstName, setFirstName] = useState<string>('')
  const [userDataLoading, setUserDataLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [topProducers, setTopProducers] = useState<any[]>([])
  const [productionData, setProductionData] = useState<any[]>([])
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [loadingScoreboard, setLoadingScoreboard] = useState(true)

  // Fetch user data from API
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setUserDataLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/user/profile?user_id=${user.id}`)

        if (!response.ok) {
          throw new Error('Failed to fetch profile data')
        }

        const result = await response.json()

        if (result.success) {
          setFirstName(result.data.firstName || 'User')
          setUserData(result.data)

          // Check if user is in onboarding status
          if (result.data.status === 'onboarding') {
            setShowOnboarding(true)
          }
        } else {
          console.error('API Error:', result.error)
          // Fallback to auth metadata
          const authFirstName = user.user_metadata?.first_name || 'User'
          setFirstName(authFirstName)
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        // Fallback to auth metadata
        const authFirstName = user.user_metadata?.first_name || 'User'
        setFirstName(authFirstName)
      } finally {
        setUserDataLoading(false)
      }
    }

    fetchUserData()
  }, [user])

  // Fetch scoreboard data for this week
  useEffect(() => {
    const fetchScoreboardData = async () => {
      if (!user) {
        setLoadingScoreboard(false)
        return
      }

      try {
        // Fetch current week's scoreboard data
        const response = await fetch('/api/scoreboard')

        if (!response.ok) {
          throw new Error('Failed to fetch scoreboard data')
        }

        const result = await response.json()

        if (result.success && result.data) {
          // Set top 5 producers
          const top5 = result.data.leaderboard.slice(0, 5).map((producer: any) => ({
            rank: producer.rank,
            name: producer.name,
            amount: `$${producer.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }))
          setTopProducers(top5)

          // Set date range
          setDateRange({
            startDate: result.data.dateRange.startDate,
            endDate: result.data.dateRange.endDate
          })

          // Calculate production chart data from daily breakdown
          const dailyProductionMap = new Map<string, number>()

          result.data.leaderboard.forEach((agent: any) => {
            if (agent.dailyBreakdown) {
              Object.entries(agent.dailyBreakdown).forEach(([date, amount]) => {
                const current = dailyProductionMap.get(date) || 0
                dailyProductionMap.set(date, current + (amount as number))
              })
            }
          })

          // Convert to chart data format
          const chartData = Array.from(dailyProductionMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, production]) => ({
              date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
              production: Math.round(production)
            }))

          setProductionData(chartData)
        }
      } catch (error) {
        console.error('Error fetching scoreboard data:', error)
      } finally {
        setLoadingScoreboard(false)
      }
    }

    fetchScoreboardData()
  }, [user])

  const handleOnboardingComplete = () => {
    // Refresh the page to show the normal dashboard
    router.refresh()
    window.location.reload()
  }

  // Show loading screen until we have both auth and a valid firstName
  if (authLoading || userDataLoading || !firstName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Show onboarding wizard if user is in onboarding status
  if (showOnboarding && userData) {
    return (
      <OnboardingWizard
        userData={userData}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  // Format date range for display
  const formatDateRange = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return 'This Week'
    }
    const start = new Date(dateRange.startDate + 'T00:00:00')
    const end = new Date(dateRange.endDate + 'T00:00:00')
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient mb-2">
          Welcome back, {firstName}.
        </h1>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>This Week</span>
          <span>•</span>
          <span>{formatDateRange()}</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Top Producers */}
        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Top Producers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              {loadingScoreboard ? 'Loading...' : `Week of ${formatDateRange()}`}
            </div>
            <div className="space-y-4">
              {loadingScoreboard ? (
                <div className="text-center py-8 text-muted-foreground">Loading top producers...</div>
              ) : topProducers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No production data available</div>
              ) : (
                topProducers.map((producer) => (
                  <div key={producer.rank} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        producer.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                        producer.rank === 2 ? 'bg-gray-400 text-gray-900' :
                        producer.rank === 3 ? 'bg-orange-500 text-orange-900' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {producer.rank}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {producer.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {producer.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Chart */}
      <Card className="professional-card">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Production</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingScoreboard ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Loading production data...
            </div>
          ) : productionData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No production data available
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Production']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="production"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    name="production"
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
