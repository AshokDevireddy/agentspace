"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BarChart3, FileText, Briefcase, AlertCircle } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/providers/AuthProvider"
import OnboardingWizard from "@/components/onboarding-wizard"
import { useTour } from "@/contexts/onboarding-tour-context"
import { useApiFetch } from "@/hooks/useApiFetch"
import { useSupabaseRpc } from "@/hooks/useSupabaseQuery"
import { useCompleteOnboarding } from "@/hooks/mutations"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/hooks/queryKeys"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryErrorDisplay } from "@/components/ui/query-error-display"
import Link from "next/link"

const PIE_CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#ffb347', '#d084d0', '#84d0d0', '#d0d084'] as const

function getWeekDateRange() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - dayOfWeek)
  sunday.setHours(0, 0, 0, 0)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  saturday.setHours(23, 59, 59, 999)
  return {
    startDate: sunday.toISOString().split('T')[0],
    endDate: saturday.toISOString().split('T')[0]
  }
}

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const { startTour, setUserRole, isTourActive } = useTour()
  const [showWizard, setShowWizard] = useState(false)
  const [hasStartedTour, setHasStartedTour] = useState(false)
  // Initialize with default to avoid hydration mismatch, then sync from localStorage
  const [viewMode, setViewMode] = useState<'just_me' | 'downlines'>('downlines')
  const [isHydrated, setIsHydrated] = useState(false)

  const weekRange = useMemo(() => getWeekDateRange(), [])
  const queryClient = useQueryClient()
  const completeOnboardingMutation = useCompleteOnboarding()

  // Sync viewMode from localStorage after hydration (avoids server/client mismatch)
  useEffect(() => {
    setIsHydrated(true)
    const saved = localStorage.getItem('dashboard_view_mode') as 'just_me' | 'downlines' | null
    if (saved) setViewMode(saved)
  }, [])

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('dashboard_view_mode', viewMode)
    }
  }, [viewMode, isHydrated])

  const { data: profileData, isLoading: profileLoading, isFetching: profileFetching, error: profileError } = useApiFetch<any>(
    queryKeys.userProfile(user?.id),
    `/api/user/profile?user_id=${user?.id}`,
    {
      enabled: !!user?.id,
      placeholderData: (previousData: any) => previousData,
    }
  )

  const { data: scoreboardResult, isLoading: scoreboardLoading, isFetching: scoreboardFetching, error: scoreboardError } = useSupabaseRpc<any>(
    queryKeys.scoreboard(user?.id || '', weekRange.startDate, weekRange.endDate),
    'get_scoreboard_data',
    { p_user_id: user?.id, p_start_date: weekRange.startDate, p_end_date: weekRange.endDate },
    {
      enabled: !!user?.id,
      staleTime: 60 * 1000, // 1 minute - scoreboard data is more static
      placeholderData: (previousData: any) => previousData,
    }
  )

  const { data: dashboardResult, isLoading: dashboardLoading, isFetching: dashboardFetching, error: dashboardError } = useSupabaseRpc<any>(
    queryKeys.dashboard(user?.id || ''),
    'get_dashboard_data_with_agency_id',
    { p_user_id: user?.id },
    {
      enabled: !!user?.id,
      placeholderData: (previousData: any) => previousData,
    }
  )

  // Combined error state for main data
  const queryError = dashboardError || scoreboardError || profileError

  const userData = profileData?.success ? profileData.data : null
  const firstName = userData?.firstName || user?.user_metadata?.first_name || 'User'

  useEffect(() => {
    if (userData) {
      setUserRole(userData.is_admin ? 'admin' : 'agent')
      if (userData.status === 'onboarding') {
        setShowWizard(true)
      }
    }
  }, [userData, setUserRole])

  const scoreboardData = scoreboardResult?.success ? scoreboardResult.data : null
  const topProducers = useMemo(() => {
    if (!scoreboardData?.leaderboard) return []
    return scoreboardData.leaderboard.slice(0, 5).map((producer: any) => ({
      rank: producer.rank,
      name: producer.name,
      amount: `$${producer.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }))
  }, [scoreboardData])

  const dateRange = scoreboardData?.dateRange || { startDate: weekRange.startDate, endDate: weekRange.endDate }

  const dashboardData = dashboardResult

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
        // Invalidate all user-related queries to refresh state
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.user }),
          queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() }),
        ])
        setShowWizard(false)
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
  const isScoreboardLoading = authLoading || scoreboardLoading
  const isPieChartLoading = authLoading || dashboardLoading

  // Background refetch indicators for stale-while-revalidate
  const isRefreshing = (dashboardFetching && !dashboardLoading) || (scoreboardFetching && !scoreboardLoading)

  const formattedDateRange = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return 'This Week'
    const start = new Date(dateRange.startDate + 'T00:00:00')
    const end = new Date(dateRange.endDate + 'T00:00:00')
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  }, [dateRange])

  const currentData = useMemo(() => {
    if (dashboardData?.your_deals || dashboardData?.downline_production) {
      return viewMode === 'just_me' ? dashboardData?.your_deals : dashboardData?.downline_production
    }
    return dashboardData || null
  }, [dashboardData, viewMode])

  const pieChartData = useMemo(() => {
    if (!currentData?.carriers_active) return []
    const totalPolicies = currentData.carriers_active.reduce((sum: number, carrier: any) => sum + carrier.active_policies, 0)
    const GROUP_THRESHOLD = 4

    const largeCarriers: any[] = []
    const smallCarriers: any[] = []

    currentData.carriers_active.forEach((carrier: any, index: number) => {
      const percentage = (carrier.active_policies / totalPolicies) * 100
      const carrierData = {
        name: carrier.carrier,
        value: carrier.active_policies,
        percentage: percentage.toFixed(1),
        fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
        showLabel: true
      }
      if (percentage >= GROUP_THRESHOLD) {
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

  const renderCustomLabel = useCallback((props: any) => {
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
    return <OnboardingWizard userData={userData} onComplete={handleOnboardingComplete} />
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
            {(dashboardData?.totals?.pending_positions || dashboardData?.pending_positions) > 0 && (
              <Link href="/agents?tab=pending-positions" className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">{dashboardData?.totals?.pending_positions || dashboardData?.pending_positions} Pending Position{(dashboardData?.totals?.pending_positions || dashboardData?.pending_positions) !== 1 ? 's' : ''}</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="professional-card rounded-md">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dashboardData && (
        <div key={viewMode} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500" data-tour="dashboard-stats">
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Active Policies</p>
              </div>
              <p className="font-bold text-foreground text-xl">{(currentData?.active_policies ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">New Policies (Last Week)</p>
              </div>
              <p className="font-bold text-foreground text-xl">{(currentData?.new_policies ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
              </div>
              <p className="font-bold text-foreground text-xl">{(currentData?.total_clients ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        ) : currentData?.carriers_active && (
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
                      {pieChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null
                      const data = payload[0].payload
                      if (data?.isOthers && data?.originalCarriers?.length > 0) {
                        return (
                          <div style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '12px', color: 'hsl(var(--foreground))' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Others: {data.value} policies ({data.percentage}%)</div>
                            <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '8px', fontSize: '12px' }}>
                              {data.originalCarriers.map((carrier: any, idx: number) => (
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

        <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Top Producers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              {isScoreboardLoading ? <Skeleton className="h-4 w-32" /> : `Week of ${formattedDateRange}`}
            </div>
            <div className="space-y-4">
              {isScoreboardLoading ? (
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
    </div>
  )
}
