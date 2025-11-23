"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { MonthRangePicker } from "@/components/ui/month-range-picker"
import { createClient } from "@/lib/supabase/client"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, Calendar } from "lucide-react"
import { usePersistedFilters } from "@/hooks/usePersistedFilters"

interface PayoutData {
  month: string
  agent_id: string
  agent_name: string
  carrier_id: string
  carrier_name: string
  deal_id: string
  policy_number: string
  annual_premium: number
  agent_commission_percentage: number
  hierarchy_total_percentage: number
  expected_payout: number
}

interface ProductionBreakdown {
  your: {
    payouts: PayoutData[]
    total: number
    count: number
  }
  downline: {
    payouts: PayoutData[]
    total: number
    count: number
  }
  total: number
  totalCount: number
}

interface CarrierOption {
  value: string
  label: string
}

interface AgentOption {
  value: string
  label: string
}

export default function ExpectedPayoutsPage() {
  const supabase = createClient()

  // Calculate default date range (current year: Jan to Dec)
  const getDefaultDateRange = () => {
    const now = new Date()
    const currentYear = now.getFullYear()

    // Default to full current year (January to December)
    const startMonth = `${currentYear}-01`
    const endMonth = `${currentYear}-12`

    return { startMonth, endMonth }
  }

  const defaultRange = getDefaultDateRange()

  // Persisted filter state using custom hook
  // Changed key to 'expected-payouts-v2' to clear old cached data with wrong calculations
  const [localFilters, appliedFilters, setLocalFilters, applyFilters, clearFilters] = usePersistedFilters(
    'expected-payouts-v2',
    {
      startMonth: defaultRange.startMonth,
      endMonth: defaultRange.endMonth,
      carrier: "all",
      agent: ""
    }
  )

  const [payouts, setPayouts] = useState<PayoutData[]>([])
  const [production, setProduction] = useState<ProductionBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Options
  const [carrierOptions, setCarrierOptions] = useState<CarrierOption[]>([{ value: "all", label: "All Carriers" }])
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([])

  // Fetch current user and available agents
  useEffect(() => {
    const fetchUserAndAgents = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          setError("Not authenticated")
          return
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userData } = await supabase
          .from('users')
          .select('id, role, agency_id')
          .eq('auth_user_id', user.id)
          .single()

        if (!userData) return

        setCurrentUserId(userData.id)
        // Set default agent if not already set (first time load)
        if (!appliedFilters.agent) {
          setLocalFilters({ agent: userData.id })
          applyFilters() // Apply the default immediately
        }

        // Fetch available agents based on role
        if (userData.role === 'admin') {
          // Admin: Get all agents in agency
          const { data: agents } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('agency_id', userData.agency_id)
            .in('role', ['agent', 'admin'])
            .order('first_name')

          if (agents) {
            setAgentOptions(agents.map(a => ({
              value: a.id,
              label: `${a.first_name} ${a.last_name}`
            })))
          }
        } else {
          // Agent: Get self and downlines
          const { data: downlines } = await supabase
            .rpc('get_agent_downline', { agent_id: userData.id })

          if (downlines) {
            setAgentOptions(downlines.map((a: any) => ({
              value: a.id,
              label: `${a.first_name} ${a.last_name}`
            })))
          }
        }

        // Fetch all carriers for filter
        const { data: carriers } = await supabase
          .from('carriers')
          .select('id, name')
          .order('name')

        if (carriers) {
          setCarrierOptions([
            { value: "all", label: "All Carriers" },
            ...carriers.map(c => ({ value: c.id, label: c.name }))
          ])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user data')
      }
    }

    fetchUserAndAgents()
  }, [])

  // Fetch payouts data (only when applied filters change)
  useEffect(() => {
    const fetchPayouts = async () => {
      if (!appliedFilters.agent) return // Wait for agent to be set

      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          setError("Not authenticated")
          return
        }

        // Calculate months difference from now using proper month arithmetic
        // Important: We need to calculate from the START of the current month
        const now = new Date()
        const nowYear = now.getFullYear()
        const nowMonth = now.getMonth() // 0-indexed (0 = January)

        // Parse start and end months from the filter (format: "YYYY-MM")
        const [startYear, startMonthStr] = appliedFilters.startMonth.split('-').map(Number)
        const [endYear, endMonthStr] = appliedFilters.endMonth.split('-').map(Number)
        const startMonthIdx = startMonthStr - 1 // Convert to 0-indexed
        const endMonthIdx = endMonthStr - 1 // Convert to 0-indexed

        // Calculate month differences from current month
        // For inclusive range: if selecting Jan-Dec, and current is Jan,
        // we want past=0 (include Jan) and future=11 (include Dec)
        const monthsPast = (nowYear - startYear) * 12 + (nowMonth - startMonthIdx)
        const monthsFuture = (endYear - nowYear) * 12 + (endMonthIdx - nowMonth)

        const params = new URLSearchParams()
        params.append('months_past', Math.abs(monthsPast).toString())
        params.append('months_future', Math.abs(monthsFuture).toString())
        params.append('agent_id', appliedFilters.agent)

        if (appliedFilters.carrier !== "all") {
          params.append('carrier_id', appliedFilters.carrier)
        }

        const response = await fetch(`/api/expected-payouts?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || errorData.message || 'Failed to fetch expected payouts')
        }

        const data = await response.json()
        setPayouts(data.payouts || [])
        setProduction(data.production || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payouts')
      } finally {
        setLoading(false)
      }
    }

    fetchPayouts()
  }, [appliedFilters, supabase.auth])

  // Apply filters handler
  const handleApplyFilters = () => {
    applyFilters()
  }

  // Aggregate data by month for chart - only include months within the selected date range
  const monthlyTotals = payouts.reduce((acc, payout) => {
    const monthKey = payout.month

    // Filter out months outside the selected range
    // Compare month strings in YYYY-MM format (e.g., "2025-01" >= "2025-01" and <= "2025-12")
    const payoutMonth = monthKey.substring(0, 7) // Get YYYY-MM from YYYY-MM-DD
    if (payoutMonth >= appliedFilters.startMonth && payoutMonth <= appliedFilters.endMonth) {
      if (!acc[monthKey]) {
        acc[monthKey] = 0
      }
      acc[monthKey] += payout.expected_payout
    }

    return acc
  }, {} as Record<string, number>)

  // Convert to array and sort by date
  const chartData = Object.entries(monthlyTotals)
    .map(([month, totalPayout]) => {
      const [year, monthStr] = month.substring(0, 7).split('-')
      const date = new Date(parseInt(year), parseInt(monthStr) - 1, 1)
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthDate: date, // Keep for sorting
        totalPayout
      }
    })
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime())
    .map(({ month, totalPayout }) => ({ month, totalPayout })) // Remove monthDate after sorting

  // Calculate total expected payout
  const totalExpectedPayout = payouts.reduce((sum, p) => sum + p.expected_payout, 0)

  // Calculate average per month
  const uniqueMonths = new Set(payouts.map(p => p.month)).size
  const averagePerMonth = uniqueMonths > 0 ? totalExpectedPayout / uniqueMonths : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Expected Payouts</h1>
        <p className="text-muted-foreground">
          View projected commission payouts based on posted deals
        </p>
      </div>

      {/* Filters */}
      <Card className="professional-card">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <>
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
                  ${(production?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {production?.totalCount || 0} deals
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
                  ${(production?.your.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {production?.your.count || 0} deals you wrote
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
                  ${(production?.downline.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {production?.downline.count || 0} downline deals
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Chart */}
      <Card className="professional-card">
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
  )
}
