"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BarChart3, FileText, Briefcase, UserCog } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useState, useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"
import OnboardingWizard from "@/components/onboarding-wizard"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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
        // Calculate current week dates (Sunday to Saturday)
        const today = new Date()
        const dayOfWeek = today.getDay()
        const sunday = new Date(today)
        sunday.setDate(today.getDate() - dayOfWeek)
        sunday.setHours(0, 0, 0, 0)
        const saturday = new Date(sunday)
        saturday.setDate(sunday.getDate() + 6)
        saturday.setHours(23, 59, 59, 999)

        const startDate = sunday.toISOString().split('T')[0]
        const endDate = saturday.toISOString().split('T')[0]

        // console.log('🔍 SCOREBOARD DEBUG - Calling RPC with user.id:', user.id, 'user.email:', user.email)

        // Use Supabase RPC function
        const supabase = createClient()
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_scoreboard_data', {
          p_user_id: user.id,
          p_start_date: startDate,
          p_end_date: endDate
        })
        // console.log('get_scoreboard_data', rpcData, rpcError)

        if (rpcError) {
          console.error('RPC Error:', rpcError)
          throw new Error(rpcError.message || 'Failed to fetch scoreboard data')
        }

        if (!rpcData || !rpcData.success || !rpcData.data) {
          throw new Error('Invalid response from scoreboard RPC')
        }

        const result = rpcData.data

        // Set top 5 producers
        const top5 = result.leaderboard.slice(0, 5).map((producer: any) => ({
          rank: producer.rank,
          name: producer.name,
          amount: `$${producer.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }))
        setTopProducers(top5)

        // Set date range
        setDateRange({
          startDate: result.dateRange.startDate,
          endDate: result.dateRange.endDate
        })

        // Calculate production chart data from daily breakdown
        const dailyProductionMap = new Map<string, number>()

        result.leaderboard.forEach((agent: any) => {
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
        // console.log('🔍 DASHBOARD DEBUG - Calling RPC with user.id:', user.id, 'user.email:', user.email)

        // Create Supabase client
        const supabase = createClient()

        // Call the RPC function to get dashboard data with user_id
        const { data, error } = await supabase.rpc('get_dashboard_data_with_agency_id', {
          p_user_id: user.id
        })
        // console.log('get_dashboard_data_with_agency_id', data, error)

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
            "clients_count": 312,
            "pending_positions": 0
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

  // Combined loading state - wait for auth, user data, and both RPCs to complete
  const isLoadingDashboardData = authLoading || userDataLoading || !firstName || loadingScoreboard || loadingDashboard || !dateRange.startDate

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
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#ffb347', '#d084d0', '#84d0d0', '#d0d084']

  // Format carriers data for pie chart
  const getPieChartData = () => {
    if (!dashboardData?.carriers_active) return []

    const totalPolicies = dashboardData.carriers_active.reduce((sum: number, carrier: any) => sum + carrier.active_policies, 0)
    const GROUP_THRESHOLD = 4 // Group slices below 4% into "Others"
    const LABEL_THRESHOLD = 5 // Threshold for label display (kept for reference, but all displayed slices show labels)

    // Separate large and small carriers
    const largeCarriers: any[] = []
    const smallCarriers: any[] = []

    dashboardData.carriers_active.forEach((carrier: any, index: number) => {
      const percentage = (carrier.active_policies / totalPolicies) * 100
      const carrierData = {
        name: carrier.carrier,
        value: carrier.active_policies,
        percentage: percentage.toFixed(1),
        fill: COLORS[index % COLORS.length],
        showLabel: true // Always show labels for all carriers that are displayed separately
      }

      if (percentage >= GROUP_THRESHOLD) {
        largeCarriers.push(carrierData)
      } else {
        smallCarriers.push(carrierData)
      }
    })

    // Sort large carriers by value (descending)
    largeCarriers.sort((a, b) => b.value - a.value)

    // If there are small carriers, group them into "Others"
    if (smallCarriers.length > 0) {
      const othersValue = smallCarriers.reduce((sum, carrier) => sum + carrier.value, 0)
      const othersPercentage = (othersValue / totalPolicies) * 100
      
      largeCarriers.push({
        name: 'Others',
        value: othersValue,
        percentage: othersPercentage.toFixed(1),
        fill: '#9ca3af', // Gray color for "Others"
        showLabel: true, // Always show label for "Others"
        isOthers: true,
        originalCarriers: smallCarriers.map(c => ({
          name: c.name,
          value: c.value,
          percentage: c.percentage
        })) // Store full carrier data for detailed tooltip
      })
    }

    return largeCarriers
  }

  // Custom label renderer that wraps long names and shows all labels
  const renderCustomLabel = (props: any) => {
    // Recharts passes label props with cx, cy, midAngle, innerRadius, outerRadius, x, y
    // The actual data is in the payload property
    const { cx, cy, midAngle, innerRadius, outerRadius, x, y, payload } = props
    
    // Safety check - if coordinates are missing, don't render
    if (x === undefined || y === undefined || !payload) {
      return null
    }

    const { name, percentage, fill } = payload

    // Safety check - if name or percentage is missing, don't render
    if (!name || percentage === undefined) {
      return null
    }

    // Show all labels for all displayed slices (all large carriers and "Others")
    // All slices in getPieChartData() have showLabel: true, so we render them all

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
        style={{ transition: 'none' }}
        key={`label-${name}`}
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
    <div className="space-y-4">
      {/* Header */}
      {isLoadingDashboardData ? (
        <div>
          <h1 className="text-4xl font-bold text-gradient mb-2">
            <span className="inline-block h-10 w-64 bg-muted animate-pulse rounded" />
          </h1>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>This Week</span>
            <span>•</span>
            <span className="inline-block h-4 w-48 bg-muted animate-pulse rounded" />
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-4xl font-bold mb-2 text-foreground">
            <span>Welcome, {firstName || 'User'}.</span>
          </h1>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>This Week</span>
            <span>•</span>
            <span>{formatDateRange()}</span>
          </div>
        </div>
      )}

      {/* Dashboard Stats Cards */}
      {isLoadingDashboardData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : !isLoadingDashboardData && dashboardData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Active Policies */}
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="w-full overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1vw + 0.5rem, 0.875rem)' }}>Active Policies</p>
                  </div>
                  <p className="font-bold text-foreground break-words leading-tight" style={{ fontSize: 'clamp(1rem, 1.2vw + 0.75rem, 1.5rem)' }}>
                    {(dashboardData.totals.active_policies ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Policies */}
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="w-full overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1vw + 0.5rem, 0.875rem)' }}>New Policies</p>
                  </div>
                  <p className="font-bold text-foreground break-words leading-tight" style={{ fontSize: 'clamp(1rem, 1.2vw + 0.75rem, 1.5rem)' }}>
                    {(dashboardData.totals.new_policies_last_month ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clients Count */}
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="w-full overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1vw + 0.5rem, 0.875rem)' }}>Total Clients</p>
                  </div>
                  <p className="font-bold text-foreground break-words leading-tight" style={{ fontSize: 'clamp(1rem, 1.2vw + 0.75rem, 1.5rem)' }}>
                    {(dashboardData.totals.clients_count ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Positions */}
          <Card className="professional-card rounded-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="w-full overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCog className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1vw + 0.5rem, 0.875rem)' }}>Pending Positions</p>
                  </div>
                  <p className="font-bold text-foreground break-words leading-tight" style={{ fontSize: 'clamp(1rem, 1.2vw + 0.75rem, 1.5rem)' }}>
                    {(dashboardData.totals.pending_positions ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Pie Chart and Scoreboard Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carrier Distribution Pie Chart */}
        {isLoadingDashboardData ? (
          <Card className="professional-card rounded-md">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-foreground" />
                <span>Active Policies by Carrier</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <div className="h-64 w-64 rounded-full bg-muted animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ) : !isLoadingDashboardData && dashboardData?.carriers_active ? (
          <Card className="professional-card rounded-md">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-foreground" />
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
                      isAnimationActive={false}
                    >
                      {getPieChartData().map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null
                        
                        const data = payload[0].payload
                        
                        // If it's "Others", show detailed breakdown
                        if (data?.isOthers && data?.originalCarriers && data.originalCarriers.length > 0) {
                          return (
                            <div
                              style={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                padding: '12px',
                                color: 'hsl(var(--foreground))',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                              }}
                            >
                              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                                Others: {data.value} policies ({data.percentage}%)
                              </div>
                              <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'hsl(var(--muted-foreground))' }}>
                                  Breakdown:
                                </div>
                                {data.originalCarriers.map((carrier: any, idx: number) => (
                                  <div
                                    key={idx}
                                    style={{
                                      fontSize: '12px',
                                      padding: '4px 0',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      gap: '12px'
                                    }}
                                  >
                                    <span>{carrier.name}:</span>
                                    <span style={{ fontWeight: '500' }}>
                                      {carrier.value} policies ({carrier.percentage}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        
                        // Regular tooltip for other slices
                        return (
                          <div
                            style={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              color: 'hsl(var(--foreground))'
                            }}
                          >
                            <div style={{ fontWeight: '500' }}>
                              {data.name}: {data.value} policies ({data.percentage}%)
                            </div>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Top Producers */}
        <Card className="professional-card rounded-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <Users className="h-5 w-5 text-foreground" />
              <span>Top Producers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              {isLoadingDashboardData ? (
                <span className="inline-block h-4 w-32 bg-muted animate-pulse rounded" />
              ) : (
                `Week of ${formatDateRange()}`
              )}
            </div>
            <div className="space-y-4">
              {isLoadingDashboardData ? (
                // Skeleton loaders matching the producer item structure
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                      <span className="h-4 w-24 bg-muted animate-pulse rounded" />
                    </div>
                    <span className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </div>
                ))
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
                    <span className="text-sm font-semibold text-foreground">
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
