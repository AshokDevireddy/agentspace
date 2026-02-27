"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { MonthRangePicker } from "@/components/ui/month-range-picker"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Calendar } from "lucide-react"
import { usePersistedFilters } from "@/hooks/usePersistedFilters"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/hooks/queryKeys"
import { apiClient } from "@/lib/api-client"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { QueryErrorDisplay } from "@/components/ui/query-error-display"
import { RefreshingIndicator } from "@/components/ui/refreshing-indicator"
import { cn } from "@/lib/utils"
import { useClientDate } from "@/hooks/useClientDate"
import { useAuth } from "@/providers/AuthProvider"

interface PayoutData {
  policyEffectiveDate: string | null
  agentId: string
  agentName: string
  carrierName: string
  dealId: string
  policyNumber: string
  premium: number
  agentCommissionPercentage: number
  hierarchyTotalPercentage: number
  hierarchyLevel: number
  isPersonal: boolean
  expectedPayout: number
  clientName: string
  productName: string
  positionName: string
  status: string
  statusStandardized: string | null
}

interface PayoutsTopLevel {
  payouts: PayoutData[]
  totalExpected: number
  totalPremium: number
  dealCount: number
  payoutEntries: number
  personalProduction: number
  downlineProduction: number
  summary: {
    byCarrier: Array<{
      carrier: string
      premium: number
      payout: number
      count: number
    }>
    byAgent: Array<{
      agentId: string
      name: string
      payout: number
      count: number
      personal: number
      downline: number
    }>
  }
}

interface CarrierOption {
  value: string
  label: string
}

interface AgentOption {
  value: string
  label: string
}

interface UserData {
  id: string
  role: string
  agencyId: string
  subscriptionTier: string
  authUserId: string
}

interface AgentResponse {
  id: string
  firstName: string
  lastName: string
}

interface CarrierResponse {
  id: string
  name: string
}

type PayoutsResponse = PayoutsTopLevel

interface DebtDeal {
  dealId: string
  clientName: string
  policyNumber: string
  carrierName: string
  premium: number
  originalCommission: number
  debtAmount: number
  status: string
  policyEffectiveDate: string | null
  daysActive: number
  monthsActive: number
  isEarlyLapse: boolean
}

interface DebtData {
  total: number
  dealCount: number
  deals: DebtDeal[]
}

interface DebtResponse {
  debt: number
  dealCount: number
  deals: DebtDeal[]
}

function LoadingSkeletonCard() {
  return (
    <Card className="professional-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-40 bg-muted animate-pulse rounded mb-2" />
        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  )
}

export default function ExpectedPayoutsPage() {
  const queryClient = useQueryClient()

  // Get auth state - ensures Supabase client is ready before making queries
  const { user: authUser, loading: authLoading } = useAuth()

  // SSR-safe date hook - returns deterministic values on server, actual values on client
  const clientDate = useClientDate()

  // Calculate default date range (current year: Jan to Dec)
  // SSR-safe: uses clientDate.year which is deterministic on server
  const defaultRange = useMemo(() => ({
    startMonth: `${clientDate.year}-01`,
    endMonth: `${clientDate.year}-12`
  }), [clientDate.year])

  // Persisted filter state using custom hook
  // Changed key to 'expected-payouts-v2' to clear old cached data with wrong calculations
  const { localFilters, appliedFilters, setLocalFilters, applyFilters, setAndApply, clearFilters } = usePersistedFilters(
    'expected-payouts-v2',
    {
      startMonth: defaultRange.startMonth,
      endMonth: defaultRange.endMonth,
      carrier: "all",
      agent: ""
    }
  )

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<string>('free')

  // Fetch current user data - waits for auth to be ready to prevent race conditions
  const { data: userData, isPending: userLoading } = useQuery({
    queryKey: queryKeys.userProfile(),
    queryFn: async () => {
      const data = await apiClient.get<UserData>('/api/users/me/')
      return {
        id: data.id,
        role: data.role,
        agencyId: data.agencyId,
        subscriptionTier: data.subscriptionTier,
        authUserId: data.authUserId
      } as UserData
    },
    // Only run query when auth is ready (authLoading is false)
    enabled: !authLoading && !!authUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Derived effective agent ID - falls back to userData.id when filter is empty
  // This prevents race conditions where queries might run before filters are set
  const effectiveAgentId = appliedFilters.agent || userData?.id || ''

  // Set current user ID and tier when userData is loaded, and persist default agent
  useEffect(() => {
    if (userData) {
      setCurrentUserId(userData.id)
      setUserTier(userData.subscriptionTier || 'free')

      // Set default agent for persistence (first time load only)
      // Note: effectiveAgentId already handles the fallback, but we persist for filter UI
      if (!appliedFilters.agent) {
        setAndApply({ agent: userData.id })
      }
    }
  }, [userData, appliedFilters.agent, setAndApply])

  // Fetch available agents
  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agentDownlines(userData?.id || ''),
    queryFn: async () => {
      if (!userData) return []

      try {
        const data = await apiClient.get<{ agents?: Array<{ id: string; firstName?: string; lastName?: string; name?: string }> }>('/api/agents/downlines/')
        return ((data.agents || (data as any)) || []).map((agent: { id: string; firstName?: string; lastName?: string; name?: string }) => ({
          id: agent.id,
          firstName: agent.firstName || agent.name?.split(' ')[0] || '',
          lastName: agent.lastName || agent.name?.split(' ').slice(1).join(' ') || ''
        })) as AgentResponse[]
      } catch {
        console.error('Error fetching agents')
        return []
      }
    },
    enabled: !!userData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const agentOptions: AgentOption[] = agents.map(a => ({
    value: a.id,
    label: [a.firstName, a.lastName].filter(Boolean).join(' ')
  }))

  // Fetch all carriers for filter
  const { data: carriers = [] } = useQuery({
    queryKey: queryKeys.carriersList(),
    queryFn: async () => {
      return apiClient.get<CarrierResponse[]>('/api/carriers/names/')
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const carrierOptions: CarrierOption[] = [
    { value: "all", label: "All Carriers" },
    ...carriers.map(c => ({ value: c.id, label: c.name }))
  ]

  // Fetch payouts data - depends on applied filters
  // Use effectiveAgentId to prevent race conditions when filter hasn't been set yet
  const {
    data: payoutsData,
    isPending: payoutsLoading,
    isFetching: payoutsFetching,
    error: payoutsError
  } = useQuery({
    queryKey: queryKeys.expectedPayoutsData({ ...appliedFilters, agent: effectiveAgentId }),
    queryFn: async () => {
      // Build proper month-aligned date range from filter values (format: "YYYY-MM")
      // First day of start month
      const startDate = `${appliedFilters.startMonth}-01`

      // Last day of end month
      const [endYear, endMonthStr] = appliedFilters.endMonth.split('-').map(Number)
      const endDay = new Date(endYear, endMonthStr, 0).getDate()
      const endDate = `${appliedFilters.endMonth}-${String(endDay).padStart(2, '0')}`

      const queryParams: Record<string, string> = {
        start_date: startDate,
        end_date: endDate,
        agent_id: effectiveAgentId,
      }

      if (appliedFilters.carrier !== "all") {
        queryParams.carrier_id = appliedFilters.carrier
      }

      return apiClient.get<PayoutsResponse>('/api/expected-payouts/', { params: queryParams })
    },
    // Wait for both effectiveAgentId AND userData to be loaded to prevent race conditions
    enabled: !!effectiveAgentId && !!userData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch to prevent flicker
  })

  const payouts = payoutsData?.payouts || []
  // Derive production totals from the flat Django response fields (after camelCase transform)
  const totalExpected = payoutsData?.totalExpected ?? 0
  const dealCount = payoutsData?.dealCount ?? 0
  const personalProduction = payoutsData?.personalProduction ?? 0
  const downlineProduction = payoutsData?.downlineProduction ?? 0

  // Fetch debt data - depends on agent filter
  // Use effectiveAgentId to prevent race conditions when filter hasn't been set yet
  const {
    data: debtData,
    isPending: debtLoading
  } = useQuery({
    queryKey: queryKeys.expectedPayoutsDebt(effectiveAgentId),
    queryFn: async () => {
      try {
        const data = await apiClient.get<DebtResponse>('/api/expected-payouts/debt/', { params: { agent_id: effectiveAgentId } })
        // Django returns flat { debt, dealCount, deals } — not nested under a "debt" key
        return {
          total: data.debt,
          dealCount: data.dealCount,
          deals: data.deals ?? [],
        } as DebtData
      } catch {
        // If debt fetch fails, return zero values
        return { total: 0, dealCount: 0, deals: [] } as DebtData
      }
    },
    // Wait for both effectiveAgentId AND userData to be loaded to prevent race conditions
    enabled: !!effectiveAgentId && !!userData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch to prevent flicker
    // Return zero values on error instead of throwing
    retry: false,
    meta: {
      errorHandler: () => ({ total: 0, dealCount: 0, deals: [] })
    }
  })

  const loading = authLoading || userLoading || payoutsLoading
  const error = payoutsError ? (payoutsError instanceof Error ? payoutsError.message : 'Failed to load payouts') : null

  // Apply filters handler
  const handleApplyFilters = () => {
    applyFilters()
  }

  // Aggregate data by month for chart - only include months within the selected date range
  // Django returns policyEffectiveDate (YYYY-MM-DD), not a separate month field
  const monthlyTotals = payouts.reduce((acc, payout) => {
    if (!payout.policyEffectiveDate) return acc

    // Extract YYYY-MM from YYYY-MM-DD
    const payoutMonth = payout.policyEffectiveDate.substring(0, 7)

    // Filter out months outside the selected range
    if (payoutMonth >= appliedFilters.startMonth && payoutMonth <= appliedFilters.endMonth) {
      if (!acc[payoutMonth]) {
        acc[payoutMonth] = 0
      }
      acc[payoutMonth] += payout.expectedPayout
    }

    return acc
  }, {} as Record<string, number>)

  // Convert to array and sort by date
  const chartData = Object.entries(monthlyTotals)
    .map(([monthKey, totalPayout]) => {
      const [year, monthStr] = monthKey.split('-')
      const date = new Date(parseInt(year), parseInt(monthStr) - 1, 1)
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthDate: date, // Keep for sorting
        totalPayout
      }
    })
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime())
    .map(({ month, totalPayout }) => ({ month, totalPayout })) // Remove monthDate after sorting

  // Background refresh indicator (stale-while-revalidate pattern)
  const isRefreshing = payoutsFetching && !payoutsLoading

  // Check if Basic tier user is viewing another agent's data
  const isViewingOtherAgent = userTier === 'basic' &&
    appliedFilters.agent &&
    currentUserId &&
    appliedFilters.agent !== currentUserId

  return (
    <div className="space-y-6 relative payouts-content" data-tour="payouts">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold text-foreground">Expected Payouts</h1>
          <RefreshingIndicator isRefreshing={isRefreshing} />
        </div>
        <p className="text-muted-foreground">
          View projected commission payouts based on posted deals
        </p>
      </div>

      {/* Error Display */}
      {payoutsError && (
        <QueryErrorDisplay
          error={payoutsError}
          onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.expectedPayoutsData({ ...appliedFilters, agent: effectiveAgentId }) })}
          variant="inline"
        />
      )}

      {/* Filters - Always interactive */}
      <Card className="professional-card relative z-[60]">
        <CardContent className="py-4">
          <div className="flex gap-4 items-end flex-wrap">
            {/* Agent Selector */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Agent
              </label>
              <SimpleSearchableSelect
                options={agentOptions}
                value={localFilters.agent}
                onValueChange={(value) => setLocalFilters({ agent: value })}
                placeholder="Select agent"
                searchPlaceholder="Search agents..."
              />
            </div>

            {/* Carrier Selector */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Carrier
              </label>
              <SimpleSearchableSelect
                options={carrierOptions}
                value={localFilters.carrier}
                onValueChange={(value) => setLocalFilters({ carrier: value })}
                placeholder="All Carriers"
                searchPlaceholder="Search carriers..."
              />
            </div>

            {/* Month Range Picker */}
            <div className="flex-[2] min-w-[280px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Date Range
              </label>
              <MonthRangePicker
                startMonth={localFilters.startMonth}
                endMonth={localFilters.endMonth}
                onRangeChange={(startMonth, endMonth) => {
                  setLocalFilters({ startMonth, endMonth })
                }}
                disabled={loading}
              />
            </div>

            {/* Filter Button */}
            <button
              onClick={handleApplyFilters}
              disabled={loading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Filters
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Content area with upgrade prompt */}
      <div className="relative">
        {/* Upgrade prompt overlay for Basic tier viewing other agents */}
        {isViewingOtherAgent && (
          <div className="absolute inset-0 z-50 pointer-events-none">
            <div className="h-full flex items-center justify-center pointer-events-auto">
              <UpgradePrompt
                title="Upgrade to View Other Agent Data"
                message="Upgrade to Pro or Expert tier to view expected payouts for other agents in your team"
                requiredTier="Pro"
                blur={false}
              />
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className={cn("grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6", isViewingOtherAgent && "blur-sm pointer-events-none")}>
        {loading ? (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeletonCard key={i} />
            ))}
          </>
        ) : (
          <>
            <Card className="professional-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expected Payout</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${totalExpected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {dealCount} deals
                </p>
              </CardContent>
            </Card>

            <Card className="professional-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Your Production</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${personalProduction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From deals you wrote
                </p>
              </CardContent>
            </Card>

            <Card className="professional-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Downline Production</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${downlineProduction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From downline deals
                </p>
              </CardContent>
            </Card>

            <Card className="professional-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                {debtLoading ? (
                  <>
                    <div className="h-8 w-40 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-destructive">
                      ${(debtData?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      From {debtData?.dealCount || 0} lapsed policies
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="professional-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {debtLoading ? (
                  <>
                    <div className="h-8 w-40 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </>
                ) : (
                  <>
                    <div className={cn(
                      "text-2xl font-bold",
                      (totalExpected - (debtData?.total || 0)) >= 0
                        ? "text-foreground"
                        : "text-destructive"
                    )}>
                      ${(totalExpected - (debtData?.total || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected Payout - Debt
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
        </div>

        {/* Chart */}
        <Card className={cn("professional-card mt-6", isViewingOtherAgent && "blur-sm pointer-events-none")}>
        <CardHeader>
          <CardTitle>Expected Payouts Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[400px] w-full flex items-center justify-center">
              <div className="w-full h-full bg-muted animate-pulse rounded" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-destructive">{error}</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  No payout data available
                </p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or post some deals to see expected payouts
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Expected Payout']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalPayout"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  name="Expected Payout"
                  dot={{ fill: 'hsl(var(--foreground))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  )
}
