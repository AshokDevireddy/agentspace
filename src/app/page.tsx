"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProductionProgressCard } from "@/components/production-progress-card"
import { Users, BarChart3, Briefcase, AlertCircle } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/providers/AuthProvider"
import OnboardingWizard from "@/components/onboarding/OnboardingWizard"
import type { UserData as OnboardingUserData } from "@/components/onboarding/types"
import { useTour } from "@/contexts/onboarding-tour-context"
import type { UserProfile, CarrierActive, PieChartEntry, LeaderboardProducer, DashboardData, DealsSummary } from "@/types"
import { useDashboardSummary, useScoreboardData, useProductionData } from "@/hooks/useDashboardData"
import { useCompleteOnboarding } from "@/hooks/mutations"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/hooks/queryKeys"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryErrorDisplay } from "@/components/ui/query-error-display"
import Link from "next/link"
import { useWeekDateRange } from "@/hooks/useClientDate"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useHydrated } from "@/hooks/useHydrated"
import { getYTDDateRange, getMTDDateRange } from "@/lib/date-utils"
import { PIE_CHART_COLORS, PIE_CHART_GROUP_THRESHOLD } from "@/lib/chart-colors"

export default function Home() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const { startTour, setUserRole, isTourActive } = useTour()
  const [showWizard, setShowWizard] = useState(false)
  const [hasStartedTour, setHasStartedTour] = useState(false)
  // SSR-safe localStorage hook - returns 'downlines' on server, synced value on client
  const [viewMode, setViewMode] = useLocalStorage<'just_me' | 'downlines'>('dashboard_view_mode', 'downlines')
  const [topProducersPeriod, setTopProducersPeriod] = useState<'ytd' | 'mtd'>('ytd')
  const isHydrated = useHydrated()

  // SSR-safe week date range - returns deterministic dates on server, actual current week on client
  const weekRange = useWeekDateRange()
  const queryClient = useQueryClient()
  const completeOnboardingMutation = useCompleteOnboarding()

  const { data: profileData, isLoading: profileLoading, error: profileError } = useQuery<UserProfile, Error>({
    queryKey: queryKeys.userProfile(user?.id),
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: UserProfile } | UserProfile>(
        `/api/user/profile`,
        { params: { user_id: user?.id } }
      )
      // Unwrap {success, data} envelope from Django
      return ('success' in response && response.data ? response.data : response) as UserProfile
    },
    enabled: !!user?.id,
    placeholderData: (previousData) => previousData,
  })

  const { isLoading: scoreboardLoading, isFetching: scoreboardFetching, error: scoreboardError } = useScoreboardData(
    user?.id,
    weekRange.startDate,
    weekRange.endDate,
    {
      enabled: !!user?.id && isHydrated,
      staleTime: 60 * 1000, // 1 minute - scoreboard data is more static
    }
  )

  const { data: dashboardResult, isLoading: dashboardLoading, isFetching: dashboardFetching, error: dashboardError } = useDashboardSummary(
    user?.id,
    {
      enabled: !!user?.id,
    }
  )

  // Calculate YTD/MTD date ranges for production and top producers
  const productionDateRanges = useMemo(() => {
    return {
      ytd: getYTDDateRange(),
      mtd: getMTDDateRange()
    }
  }, [])

  // Top producers query with YTD/MTD period selection
  const topProducersRange = topProducersPeriod === 'ytd' ? productionDateRanges.ytd : productionDateRanges.mtd

  const { data: topProducersResult, isLoading: topProducersLoading } = useScoreboardData(
    user?.id,
    topProducersRange.start,
    topProducersRange.end,
    {
      enabled: !!user?.id,
      staleTime: 60 * 1000,
    }
  )

  // YTD production query for ProductionProgressCard
  const { data: ytdProductionResult, isLoading: ytdProductionLoading } = useProductionData(
    user?.id,
    user?.id ? [user.id] : [],
    productionDateRanges.ytd.start,
    productionDateRanges.ytd.end,
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )

  // MTD production query for ProductionProgressCard
  const { data: mtdProductionResult, isLoading: mtdProductionLoading } = useProductionData(
    user?.id,
    user?.id ? [user.id] : [],
    productionDateRanges.mtd.start,
    productionDateRanges.mtd.end,
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )

  // Extract production values for ProductionProgressCard
  const ytdProduction = useMemo(() => {
    const data = ytdProductionResult?.[0]
    return {
      individual: data?.individualProduction || 0,
      hierarchy: data?.hierarchyProduction || 0
    }
  }, [ytdProductionResult])

  const mtdProduction = useMemo(() => {
    const data = mtdProductionResult?.[0]
    return {
      individual: data?.individualProduction || 0,
      hierarchy: data?.hierarchyProduction || 0
    }
  }, [mtdProductionResult])

  const isProductionLoading = ytdProductionLoading || mtdProductionLoading

  // Combined error state for main data
  const queryError = dashboardError || scoreboardError || profileError

  const userData = profileData || null
  const firstName = userData?.firstName || 'User'
  const isAdmin = userData?.isAdmin || false

  useEffect(() => {
    if (userData) {
      setUserRole(userData.isAdmin ? 'admin' : 'agent')
      // Show wizard only if status is 'onboarding', hide if status changes to 'active'
      setShowWizard(userData.status === 'onboarding')
    }
  }, [userData, setUserRole])

  const topProducers: { rank: number; name: string; amount: string }[] = useMemo(() => {
    if (!topProducersResult?.entries) return []
    return topProducersResult.entries.slice(0, 5).map((producer: LeaderboardProducer) => ({
      rank: producer.rank,
      name: producer.agentName,
      amount: `$${parseFloat(producer.production).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }))
  }, [topProducersResult])

  useEffect(() => {
    if (!authLoading && !profileLoading && userData && user?.id) {
      const oldKey = `tour_shown_${user.id}`
      if (localStorage.getItem(oldKey)) {
        localStorage.removeItem(oldKey)
      }
      const tourCompleted = localStorage.getItem(`tour_completed_${user.id}`)
      if (userData.status === 'active' && !tourCompleted && !isTourActive && !hasStartedTour) {
        setTimeout(() => {
          startTour()
          setHasStartedTour(true)
        }, 500)
      }
    }
  }, [authLoading, profileLoading, userData, isTourActive, hasStartedTour, startTour, user?.id])

  const handleOnboardingComplete = () => {
    completeOnboardingMutation.mutate(undefined, {
      onSuccess: async () => {
        // Refresh AuthProvider state so client-layout shows sidebar immediately
        await refreshUser()
        // Force refetch of active queries to immediately update UI
        await Promise.all([
          queryClient.refetchQueries({ queryKey: queryKeys.user, type: 'active' }),
          queryClient.refetchQueries({ queryKey: queryKeys.userProfile(), type: 'active' }),
        ])
        // showWizard will be automatically set to false by the useEffect watching userData.status
      },
      onError: async (error) => {
        console.error('Error completing onboarding:', error)
        // Don't close wizard on error - let user retry
        // The wizard handles its own error display via setErrors()
        await queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() })
      },
    })
  }

  // Decoupled loading states per section for better UX
  // Include authLoading to show skeletons while auth is initializing (prevents "no data" flash)
  const isHeaderLoading = authLoading || profileLoading
  const isStatsLoading = authLoading || dashboardLoading
  const isPieChartLoading = authLoading || dashboardLoading

  // Background refetch indicators for stale-while-revalidate
  const isRefreshing = (dashboardFetching && !dashboardLoading) || (scoreboardFetching && !scoreboardLoading)

  const formattedDateRange = useMemo(() => {
    if (!weekRange.startDate || !weekRange.endDate) return 'This Week'
    const start = new Date(weekRange.startDate + 'T00:00:00')
    const end = new Date(weekRange.endDate + 'T00:00:00')
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  }, [weekRange])

  const currentData = useMemo((): DealsSummary | DashboardData | null => {
    if (dashboardResult?.yourDeals || dashboardResult?.downlineProduction) {
      return viewMode === 'just_me' ? dashboardResult?.yourDeals : dashboardResult?.downlineProduction
    }
    return dashboardResult || null
  }, [dashboardResult, viewMode])

  const pieChartData = useMemo(() => {
    if (!currentData?.carriersActive) return []
    const totalPolicies = currentData.carriersActive.reduce((sum: number, carrier: CarrierActive) => sum + carrier.activePolicies, 0)

    const largeCarriers: PieChartEntry[] = []
    const smallCarriers: PieChartEntry[] = []

    currentData.carriersActive.forEach((carrier: CarrierActive, index: number) => {
      const percentage = (carrier.activePolicies / totalPolicies) * 100
      const carrierData: PieChartEntry = {
        name: carrier.carrier,
        value: carrier.activePolicies,
        percentage: percentage.toFixed(1),
        fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
        showLabel: true
      }
      if (percentage >= PIE_CHART_GROUP_THRESHOLD) {
        largeCarriers.push(carrierData)
      } else {
        smallCarriers.push(carrierData)
      }
    })

    largeCarriers.sort((a, b) => b.value - a.value)

    if (smallCarriers.length > 0) {
      const othersValue = smallCarriers.reduce((sum, carrier) => sum + carrier.value, 0)
      const othersPercentage = (othersValue / totalPolicies) * 100
      largeCarriers.push({
        name: 'Others',
        value: othersValue,
        percentage: othersPercentage.toFixed(1),
        fill: '#9ca3af',
        showLabel: true,
        isOthers: true,
        originalCarriers: smallCarriers.map(c => ({ name: c.name, value: c.value, percentage: c.percentage }))
      })
    }

    return largeCarriers
  }, [currentData])

  interface PieLabelProps {
    cx: number
    cy: number
    x: number
    y: number
    payload: PieChartEntry
  }

  const renderCustomLabel = useCallback((props: PieLabelProps) => {
    const { cx, cy, x, y, payload } = props
    if (x === undefined || y === undefined || !payload) return null
    const { name, percentage, fill } = payload
    if (!name || percentage === undefined) return null

    const splitName = (text: string) => {
      if (text.length <= 12) return { line1: text, line2: '' }
      const mid = Math.floor(text.length / 2)
      const spaceIndex = text.lastIndexOf(' ', mid + 3)
      const splitIndex = spaceIndex > mid - 3 ? spaceIndex : mid
      return { line1: text.substring(0, splitIndex).trim(), line2: text.substring(splitIndex).trim() }
    }

    const { line1, line2 } = splitName(name)
    const textAnchor = x > cx ? 'start' : 'end'

    return (
      <text x={x} y={line2 ? y - 10 : y} textAnchor={textAnchor} fontSize={12} fill={fill || '#333'} key={`label-${name}`}>
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

  if (showWizard && userData) {
    // Transform camelCase profile data to snake_case expected by OnboardingWizard
    const wizardUserData: OnboardingUserData = {
      id: userData.id,
      first_name: userData.firstName || '',
      last_name: userData.lastName || '',
      email: user?.email || '',
      role: userData.role as 'admin' | 'agent' | 'client',
      is_admin: userData.isAdmin,
      agency_id: userData.agencyId ?? undefined,
    }
    return <OnboardingWizard userData={wizardUserData} onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="space-y-4 dashboard-content" data-tour="dashboard">
      {queryError && !isStatsLoading && (
        <QueryErrorDisplay
          error={queryError}
          onRetry={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(user?.id || '') })
            queryClient.invalidateQueries({ queryKey: queryKeys.scoreboard(user?.id || '', weekRange.startDate, weekRange.endDate) })
            queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(user?.id) })
          }}
          variant="inline"
        />
      )}
      {isHeaderLoading ? (
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-foreground">Welcome, {firstName}.</h1>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>This Week • {formattedDateRange}</span>
              {isRefreshing && (
                <span className="text-xs text-muted-foreground/70 animate-pulse">Refreshing...</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {(dashboardResult?.totals?.pendingPositions || 0) > 0 && (
              <Link href="/agents?tab=pending-positions" className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Pending Positions</span>
              </Link>
            )}
            <div className="relative bg-muted/50 p-1 rounded-lg">
              <div className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out" style={{ left: viewMode === 'just_me' ? '4px' : 'calc(50%)', width: 'calc(50% - 4px)' }} />
              <div className="relative z-10 flex">
                <button onClick={() => setViewMode('just_me')} className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${viewMode === 'just_me' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Just Me</button>
                <button onClick={() => setViewMode('downlines')} className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${viewMode === 'downlines' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Downlines</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStatsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="professional-card rounded-md">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dashboardResult && (
        <div key={viewMode} className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500" data-tour="dashboard-stats">
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Active Policies</p>
              </div>
              <p className="font-bold text-foreground text-xl">{(currentData?.activePolicies ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
              </div>
              <p className="font-bold text-foreground text-xl">{(currentData?.totalClients ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Production Progress + Top Producers Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Progress */}
        <ProductionProgressCard
          viewMode={viewMode}
          ytdProduction={ytdProduction}
          mtdProduction={mtdProduction}
          loading={isProductionLoading}
          isAdmin={isAdmin}
        />

        {/* Top Producers */}
        <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Top Producers</span>
              </CardTitle>
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={topProducersPeriod === 'ytd' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTopProducersPeriod('ytd')}
                  className="h-7 px-3 text-xs"
                >
                  YTD
                </Button>
                <Button
                  variant={topProducersPeriod === 'mtd' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTopProducersPeriod('mtd')}
                  className="h-7 px-3 text-xs"
                >
                  MTD
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              {topProducersLoading ? (
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
              {topProducersLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              ) : topProducers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No production data available</div>
              ) : (
                topProducers.map((producer) => (
                  <div key={producer.rank} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${producer.rank === 1 ? 'bg-yellow-500 text-yellow-900' : producer.rank === 2 ? 'bg-gray-400 text-gray-900' : producer.rank === 3 ? 'bg-orange-500 text-orange-900' : 'bg-muted text-muted-foreground'}`}>
                        {producer.rank}
                      </div>
                      <span className="text-sm font-medium text-foreground">{producer.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{producer.amount}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart Section */}
      <div>
        {isPieChartLoading ? (
          <Card className="professional-card rounded-md">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Active Policies by Carrier</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <Skeleton className="h-64 w-64 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ) : currentData?.carriersActive && (
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg" key={`pie-${viewMode}`}>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Active Policies by Carrier</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 animate-in fade-in duration-500">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieChartData} cx="50%" cy="50%" labelLine={false} label={renderCustomLabel} outerRadius={100} dataKey="value" animationDuration={800}>
                      {pieChartData.map((entry: PieChartEntry, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null
                      const data = payload[0].payload as PieChartEntry
                      if (data?.isOthers && data?.originalCarriers && data.originalCarriers.length > 0) {
                        return (
                          <div style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '12px', color: 'hsl(var(--foreground))' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Others: {data.value} policies ({data.percentage}%)</div>
                            <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '8px', fontSize: '12px' }}>
                              {data.originalCarriers.map((carrier, idx: number) => (
                                <div key={idx} style={{ padding: '4px 0', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                  <span>{carrier.name}:</span>
                                  <span>{carrier.value} ({carrier.percentage}%)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '8px 12px', color: 'hsl(var(--foreground))' }}>
                          {data.name}: {data.value} policies ({data.percentage}%)
                        </div>
                      )
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
