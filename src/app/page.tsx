"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProductionProgressCard } from "@/components/production-progress-card"
import { Users, BarChart3, FileText, Briefcase, AlertCircle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/providers/AuthProvider"
import OnboardingWizard from "@/components/onboarding-wizard"
import { useTour } from "@/contexts/onboarding-tour-context"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

const PIE_CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#ffb347', '#d084d0', '#84d0d0', '#d0d084'] as const

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const { startTour, setUserRole, isTourActive } = useTour()
  const [firstName, setFirstName] = useState<string>('')
  const [userDataLoading, setUserDataLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [hasStartedTour, setHasStartedTour] = useState(false)
  const [topProducers, setTopProducers] = useState<any[]>([])
  const [productionData, setProductionData] = useState<any[]>([])
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [loadingScoreboard, setLoadingScoreboard] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [ytdProduction, setYtdProduction] = useState<{ individual: number; hierarchy: number }>({ individual: 0, hierarchy: 0 })
  const [mtdProduction, setMtdProduction] = useState<{ individual: number; hierarchy: number }>({ individual: 0, hierarchy: 0 })
  const [loadingProduction, setLoadingProduction] = useState(true)
  const [topProducersPeriod, setTopProducersPeriod] = useState<'ytd' | 'mtd'>('ytd')
  const [viewMode, setViewMode] = useState<'just_me' | 'downlines'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dashboard_view_mode') as 'just_me' | 'downlines') || 'downlines'
    }
    return 'downlines'
  })

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode)
  }, [viewMode])

  // Fetch all dashboard data in parallel
  useEffect(() => {
    const fetchAllDashboardData = async () => {
      if (!user) {
        setUserDataLoading(false)
        setLoadingScoreboard(false)
        setLoadingDashboard(false)
        return
      }

      const supabase = createClient()
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`

      // Calculate top producers dates based on period (YTD or MTD)
      let topProducersStartDate: string
      let topProducersEndDate = todayStr
      
      if (topProducersPeriod === 'ytd') {
        topProducersStartDate = `${year}-01-01`
      } else {
        topProducersStartDate = `${year}-${month}-01`
      }

      // Run all 3 fetches in PARALLEL using Promise.allSettled
      const [userResult, scoreboardResult, dashboardResult] = await Promise.allSettled([
        // 1. User profile fetch
        fetch(`/api/user/profile?user_id=${user.id}`).then(res => res.json()),

        // 2. Scoreboard RPC for top producers
        supabase.rpc('get_scoreboard_data', {
          p_user_id: user.id,
          p_start_date: topProducersStartDate,
          p_end_date: topProducersEndDate
        }),

        // 3. Dashboard analytics RPC
        supabase.rpc('get_dashboard_data_with_agency_id', {
          p_user_id: user.id
        })
      ])

      // Process user profile result
      if (userResult.status === 'fulfilled' && userResult.value?.success) {
        const result = userResult.value
        setFirstName(result.data.firstName || 'User')
        setUserData(result.data)
        setUserRole(result.data.is_admin ? 'admin' : 'agent')

        if (result.data.status === 'onboarding') {
          setShowOnboarding(true)
          setShowWizard(true)
        }
      } else {
        console.error('Error fetching user data:', userResult.status === 'rejected' ? userResult.reason : 'Unknown error')
        const authFirstName = user.user_metadata?.first_name || 'User'
        setFirstName(authFirstName)
      }
      setUserDataLoading(false)

      // Process scoreboard result
      if (scoreboardResult.status === 'fulfilled') {
        const { data: rpcData, error: rpcError } = scoreboardResult.value
        if (!rpcError && rpcData?.success && rpcData?.data) {
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

          const chartData = Array.from(dailyProductionMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, production]) => ({
              date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
              production: Math.round(production)
            }))
          setProductionData(chartData)
        } else {
          console.error('Error fetching scoreboard data:', rpcError)
        }
      } else {
        console.error('Error fetching scoreboard data:', scoreboardResult.reason)
      }
      setLoadingScoreboard(false)

      // Process dashboard result
      if (dashboardResult.status === 'fulfilled') {
        const { data, error } = dashboardResult.value
        if (!error && data) {
          setDashboardData(data)
        } else {
          console.error('Error fetching dashboard data:', error)
          // Fallback to mock data on error
          setDashboardData({
            "totals": {
              "active_policies": 1285,
              "monthly_commissions": 52430.50,
              "new_policies_last_month": 94,
              "clients_count": 312,
              "pending_positions": 0
            },
            "carriers_active": [
              { "carrier_id": "7d7a2b29-3e88-4a53-b1c4-1cc4b736e235", "carrier": "Aetna Life", "active_policies": 542 },
              { "carrier_id": "e9f9d05a-1a1b-4b0e-9550-2450b657812f", "carrier": "MetLife", "active_policies": 388 },
              { "carrier_id": "5e9a7f42-891d-40be-90a2-93f56b941121", "carrier": "United Healthcare", "active_policies": 355 }
            ]
          })
        }
      } else {
        console.error('Error fetching dashboard data:', dashboardResult.reason)
      }
      setLoadingDashboard(false)
    }

    fetchAllDashboardData()
  }, [user, topProducersPeriod])

  // Fetch YTD and MTD production data
  useEffect(() => {
    const fetchProductionData = async () => {
      if (!user) {
        setLoadingProduction(false)
        return
      }

      const supabase = createClient()
      const today = new Date()

      // Format dates as YYYY-MM-DD strings directly to avoid timezone issues
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`

      // YTD: Jan 1 of current year to today
      const ytdStart = `${year}-01-01`
      const ytdEnd = todayStr

      // MTD: 1st of current month to today
      const mtdStart = `${year}-${month}-01`
      const mtdEnd = todayStr

      // Get agency-wide production totals (for downlines view)
      const { data: ytdAgencyData } = await supabase
        .from('deals')
        .select('annual_premium')
        .gte('policy_effective_date', ytdStart)
        .lte('policy_effective_date', ytdEnd)

      const { data: mtdAgencyData } = await supabase
        .from('deals')
        .select('annual_premium')
        .gte('policy_effective_date', mtdStart)
        .lte('policy_effective_date', mtdEnd)

      const ytdAgencyTotal = (ytdAgencyData || []).reduce((sum, d) => sum + (d.annual_premium || 0), 0)
      const mtdAgencyTotal = (mtdAgencyData || []).reduce((sum, d) => sum + (d.annual_premium || 0), 0)

      try {
        // Fetch YTD and MTD production for individual (just me) view
        const [ytdResult, mtdResult] = await Promise.all([
          supabase.rpc('get_agents_debt_production', {
            p_user_id: user.id,
            p_agent_ids: [user.id],
            p_start_date: ytdStart,
            p_end_date: ytdEnd
          }),
          supabase.rpc('get_agents_debt_production', {
            p_user_id: user.id,
            p_agent_ids: [user.id],
            p_start_date: mtdStart,
            p_end_date: mtdEnd
          })
        ])

        if (ytdResult.data && !ytdResult.error) {
          const ytdData = ytdResult.data[0] || { individual_production: 0 }
          setYtdProduction({
            individual: ytdData.individual_production || 0,
            hierarchy: ytdAgencyTotal
          })
        }

        if (mtdResult.data && !mtdResult.error) {
          const mtdData = mtdResult.data[0] || { individual_production: 0 }
          setMtdProduction({
            individual: mtdData.individual_production || 0,
            hierarchy: mtdAgencyTotal
          })
        }
      } catch (error) {
        console.error('[Production] Error fetching production data:', error)
      } finally {
        setLoadingProduction(false)
      }
    }

    fetchProductionData()
  }, [user])

  // Auto-start tour for newly active users (who just completed the wizard)
  useEffect(() => {
    if (!authLoading && !userDataLoading && userData && user?.id) {
      // Migration: Remove old localStorage key
      const oldKey = `tour_shown_${user.id}`
      if (localStorage.getItem(oldKey)) {
        localStorage.removeItem(oldKey)
      }

      // Check if user just became active and hasn't completed the tour yet
      const tourCompleted = localStorage.getItem(`tour_completed_${user.id}`)

      console.log('Tour check:', {
        status: userData.status,
        tourCompleted,
        isTourActive,
        hasStartedTour
      })

      if (userData.status === 'active' && !tourCompleted && !isTourActive && !hasStartedTour) {
        console.log('Starting tour...')
        // Small delay to ensure navbar is rendered
        setTimeout(() => {
          startTour()
          setHasStartedTour(true)
        }, 500)
      }
    }
  }, [authLoading, userDataLoading, userData, isTourActive, hasStartedTour, startTour, user?.id])

  const handleOnboardingComplete = async () => {
    // Wizard completed - update user status to active
    try {
      const response = await fetch('/api/user/complete-onboarding', {
        method: 'POST',
      })

      if (!response.ok) {
        console.error('Complete onboarding API failed:', response.status)
      }

      // Reload to get fresh user status
      window.location.reload()
    } catch (error) {
      console.error('Error completing onboarding:', error)
      // Still reload - status might have been updated by wizard
      window.location.reload()
    }
  }

  // Combined loading state - wait for auth, user data, and both RPCs to complete
  const isLoadingDashboardData = authLoading || userDataLoading || !firstName || loadingScoreboard || loadingDashboard || !dateRange.startDate

  const formattedDateRange = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return 'This Week'
    }
    const start = new Date(dateRange.startDate + 'T00:00:00')
    const end = new Date(dateRange.endDate + 'T00:00:00')
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  }, [dateRange.startDate, dateRange.endDate])

  const currentData = useMemo(() => {
    // Backward compatibility: if dashboardData has the new split structure, use it
    if (dashboardData?.your_deals || dashboardData?.downline_production) {
      if (viewMode === 'just_me') {
        return dashboardData?.your_deals || null
      } else {
        return dashboardData?.downline_production || null
      }
    }
    // Otherwise, use old flat structure (before migration)
    return dashboardData || null
  }, [dashboardData, viewMode])

  const pieChartData = useMemo(() => {
    if (!currentData?.carriers_active) return []

    const totalPolicies = currentData.carriers_active.reduce((sum: number, carrier: any) => sum + carrier.active_policies, 0)
    const GROUP_THRESHOLD = 4 // Group slices below 4% into "Others"

    // Separate large and small carriers
    const largeCarriers: any[] = []
    const smallCarriers: any[] = []

    currentData.carriers_active.forEach((carrier: any, index: number) => {
      const percentage = (carrier.active_policies / totalPolicies) * 100
      const carrierData = {
        name: carrier.carrier,
        value: carrier.active_policies,
        percentage: percentage.toFixed(1),
        fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
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
  }, [currentData])

  const renderCustomLabel = useCallback((props: any) => {
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
  }, [])

  // Show onboarding wizard if user is in onboarding status and hasn't completed wizard
  if (showOnboarding && showWizard && userData) {
    return (
      <OnboardingWizard
        userData={userData}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  return (
    <div className="space-y-4 dashboard-content" data-tour="dashboard">
      {/* Header with Toggle and Pending Positions */}
      {isLoadingDashboardData ? (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">
              <span className="inline-block h-10 w-64 bg-muted animate-pulse rounded" />
            </h1>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span className="inline-block h-4 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-foreground">
              <span>Welcome, {firstName || 'User'}.</span>
            </h1>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>This Week • {formattedDateRange}</span>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-4">
            {/* Pending Positions Error Indicator */}
            {(dashboardData?.totals?.pending_positions || dashboardData?.pending_positions) && (dashboardData?.totals?.pending_positions > 0 || dashboardData?.pending_positions > 0) && (
              <Link
                href="/agents?tab=pending-positions"
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
              >
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">{(dashboardData?.totals?.pending_positions || dashboardData?.pending_positions || 0)} Pending Position{(dashboardData?.totals?.pending_positions || dashboardData?.pending_positions || 0) !== 1 ? 's' : ''}</span>
              </Link>
            )}

            {/* Just Me / Downlines Toggle */}
            <div className="relative bg-muted/50 p-1 rounded-lg">
              {/* Animated background slider */}
              <div
                className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out"
                style={{
                  left: viewMode === 'just_me' ? '4px' : 'calc(50%)',
                  width: 'calc(50% - 4px)'
                }}
              />
              <div className="relative z-10 flex">
                <button
                  onClick={() => setViewMode('just_me')}
                  className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${
                    viewMode === 'just_me'
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Just Me
                </button>
                <button
                  onClick={() => setViewMode('downlines')}
                  className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${
                    viewMode === 'downlines'
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Downlines
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Stats Section - switches based on viewMode */}
      {!isLoadingDashboardData && dashboardData && (
        <div
          key={viewMode}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
          data-tour="dashboard-stats"
        >
          {/* Active Policies */}
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="w-full overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1vw + 0.5rem, 0.875rem)' }}>Active Policies</p>
                  </div>
                  <p className="font-bold text-foreground break-words leading-tight transition-all duration-300" style={{ fontSize: 'clamp(1rem, 1.2vw + 0.75rem, 1.5rem)' }}>
                    {(currentData?.active_policies ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Clients */}
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="w-full overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1vw + 0.5rem, 0.875rem)' }}>Total Clients</p>
                  </div>
                  <p className="font-bold text-foreground break-words leading-tight transition-all duration-300" style={{ fontSize: 'clamp(1rem, 1.2vw + 0.75rem, 1.5rem)' }}>
                    {(currentData?.total_clients ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isLoadingDashboardData && (
        <div className="space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="professional-card rounded-md">
                <CardContent className="p-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                    <div className="h-8 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Production Progress + Top Producers Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Progress */}
        <ProductionProgressCard
          viewMode={viewMode}
          ytdProduction={ytdProduction}
          mtdProduction={mtdProduction}
          loading={loadingProduction}
        />

        {/* Top Producers */}
        <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
                <Users className="h-5 w-5 text-foreground" />
                <span>Top Producers</span>
              </CardTitle>
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={topProducersPeriod === 'ytd' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTopProducersPeriod('ytd')}
                  className="h-8 px-3 text-xs"
                >
                  YTD
                </Button>
                <Button
                  variant={topProducersPeriod === 'mtd' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTopProducersPeriod('mtd')}
                  className="h-8 px-3 text-xs"
                >
                  MTD
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              {isLoadingDashboardData ? (
                <span className="inline-block h-4 w-32 bg-muted animate-pulse rounded" />
              ) : (
                <div className="flex flex-col gap-1">
                  <span>
                    {topProducersPeriod === 'ytd' ? 'Year to Date' : 'Month to Date'}
                    {(() => {
                      const today = new Date()
                      const year = today.getFullYear()
                      const month = today.getMonth()
                      const day = today.getDate()
                      
                      let startDate: Date
                      if (topProducersPeriod === 'ytd') {
                        startDate = new Date(year, 0, 1) // Jan 1
                      } else {
                        startDate = new Date(year, month, 1) // First of current month
                      }
                      const endDate = new Date(year, month, day)
                      
                      const formatDate = (date: Date) => {
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      }
                      
                      return ` • ${formatDate(startDate)} - ${formatDate(endDate)}`
                    })()}
                  </span>
                  <span className="text-xs">Based on Submitted Policies</span>
                </div>
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

      {/* Carrier Distribution Pie Chart - Full Width */}
      {!isLoadingDashboardData && currentData?.carriers_active && (
        <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg" key={`pie-${viewMode}`}>
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-foreground" />
              <span>Active Policies by Carrier</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 animate-in fade-in duration-500">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={800}
                    animationBegin={0}
                  >
                    {pieChartData.map((entry: any, index: number) => (
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
      )}

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
