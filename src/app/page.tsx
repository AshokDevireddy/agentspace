"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BarChart3, FileText, DollarSign, TrendingUp, Briefcase } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useState, useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"
import OnboardingWizard from "@/components/onboarding-wizard"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * Retrieves the agency ID for the current user
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID (auth_user_id)
 * @returns Promise<string> - The agency ID
 */
async function getAgencyId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', userId)
      .single()

    if (error || !user) {
      throw new Error('Failed to fetch user agency')
    }

    if (!user.agency_id) {
      throw new Error('User is not associated with an agency')
    }

    return user.agency_id
  } catch (error) {
    console.error('Error fetching agency ID:', error)
    throw error instanceof Error ? error : new Error('Failed to retrieve agency ID')
  }
}

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
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)

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

  // Fetch dashboard analytics data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) {
        setLoadingDashboard(false)
        return
      }

      try {
        // Create Supabase client
        const supabase = createClient()
        
        // Get the agency ID for the current user
        const agencyId = await getAgencyId(supabase, user.id)
        
        // Call the RPC function to get dashboard data
        const { data, error } = await supabase.rpc('get_dashboard_data_with_agency_id', {
          p_agency_id: agencyId
        })

        if (error) {
          console.error('Error calling RPC:', error)
          throw error
        }

        if (!data) {
          console.error('No data returned from RPC')
          return
        }

        setDashboardData(data)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Fallback to mock data on error
        const mockData = {
          "totals": {
            "active_policies": 1285,
            "monthly_commissions": 52430.50,
            "new_policies_last_month": 94,
            "clients_count": 312
          },
          "carriers_active": [
            {
              "carrier_id": "7d7a2b29-3e88-4a53-b1c4-1cc4b736e235",
              "carrier": "Aetna Life",
              "active_policies": 542
            },
            {
              "carrier_id": "e9f9d05a-1a1b-4b0e-9550-2450b657812f",
              "carrier": "MetLife",
              "active_policies": 388
            },
            {
              "carrier_id": "5e9a7f42-891d-40be-90a2-93f56b941121",
              "carrier": "United Healthcare",
              "active_policies": 355
            }
          ]
        }
        setDashboardData(mockData)
      } finally {
        setLoadingDashboard(false)
      }
    }

    fetchDashboardData()
  }, [user])

  const handleOnboardingComplete = () => {
    // Refresh the page to show the normal dashboard
    router.refresh()
    window.location.reload()
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

  // Colors for pie chart
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#ffb347']

  // Format carriers data for pie chart
  const getPieChartData = () => {
    if (!dashboardData?.carriers_active) return []
    
    const totalPolicies = dashboardData.carriers_active.reduce((sum: number, carrier: any) => sum + carrier.active_policies, 0)
    
    return dashboardData.carriers_active.map((carrier: any, index: number) => ({
      name: carrier.carrier,
      value: carrier.active_policies,
      percentage: ((carrier.active_policies / totalPolicies) * 100).toFixed(1),
      fill: COLORS[index % COLORS.length] // Add color to each entry
    }))
  }

  // Custom label renderer that wraps long names
  const renderCustomLabel = (entry: any) => {
    const { name, percentage, fill, cx, cy, midAngle, innerRadius, outerRadius, x, y } = entry
    
    // Helper function to split name at the middle if too long
    const splitName = (text: string) => {
      if (text.length <= 12) return { line1: text, line2: '' }
      const mid = Math.floor(text.length / 2)
      // Try to split at a space near the middle
      const spaceIndex = text.lastIndexOf(' ', mid + 3)
      const splitIndex = spaceIndex > mid - 3 ? spaceIndex : mid
      return {
        line1: text.substring(0, splitIndex).trim(),
        line2: text.substring(splitIndex).trim()
      }
    }

    const { line1, line2 } = splitName(name)
    const textAnchor = x > cx ? 'start' : 'end'

    return (
      <text 
        x={x} 
        y={line2 ? y - 10 : y} 
        textAnchor={textAnchor}
        fontSize={12}
        fill={fill || '#333'}
      >
        {line2 ? (
          <>
            <tspan x={x} dy="0" fill={fill || '#333'}>{line1}</tspan>
            <tspan x={x} dy="14" fill={fill || '#333'}>{line2}: {percentage}%</tspan>
          </>
        ) : (
          <tspan x={x} dy="0" fill={fill || '#333'}>{name}: {percentage}%</tspan>
        )}
      </text>
    )
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

      {/* Dashboard Stats Cards */}
      {loadingDashboard ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : dashboardData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Policies */}
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Active Policies</p>
                  </div>
                  <p className="text-4xl font-bold text-foreground">
                    {dashboardData.totals.active_policies.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-4 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">2.5%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Commissions */}
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Monthly Commissions</p>
                  </div>
                  <p className="text-4xl font-bold text-foreground">
                    ${dashboardData.totals.monthly_commissions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-1 mt-4 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">5%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Policies Last Month */}
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">New Policies (Last Month)</p>
                  </div>
                  <p className="text-4xl font-bold text-foreground">
                    {dashboardData.totals.new_policies_last_month.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-4 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">1%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clients Count */}
          <Card className="professional-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  </div>
                  <p className="text-4xl font-bold text-foreground">
                    {dashboardData.totals.clients_count.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-4 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">2.5%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Pie Chart and Scoreboard Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carrier Distribution Pie Chart */}
        {loadingDashboard ? (
          <Card className="professional-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">Carrier Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </CardContent>
          </Card>
        ) : dashboardData?.carriers_active ? (
          <Card className="professional-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span>Active Policies by Carrier</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getPieChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getPieChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${value} policies`,
                        name
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

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

      {/* Production Chart - COMMENTED OUT */}
      {/* <Card className="professional-card">
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
      </Card> */}
    </div>
  )
}
