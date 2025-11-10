"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Slider } from "@/components/ui/slider"
import { createClient } from "@/lib/supabase/client"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, Calendar } from "lucide-react"

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

  const [payouts, setPayouts] = useState<PayoutData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Filter states (temporary - not applied until filter button clicked)
  const [tempDateRange, setTempDateRange] = useState<[number, number]>([-12, 12]) // Past, Future
  const [tempCarrier, setTempCarrier] = useState("all")
  const [tempAgent, setTempAgent] = useState<string>("")

  // Applied filter states (used for API calls)
  const [appliedDateRange, setAppliedDateRange] = useState<[number, number]>([-12, 12])
  const [appliedCarrier, setAppliedCarrier] = useState("all")
  const [appliedAgent, setAppliedAgent] = useState<string>("")

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
        setTempAgent(userData.id)
        setAppliedAgent(userData.id) // Default to current user

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
        console.error('Error fetching user and agents:', err)
        setError(err instanceof Error ? err.message : 'Failed to load user data')
      }
    }

    fetchUserAndAgents()
  }, [])

  // Fetch payouts data (only when applied filters change)
  useEffect(() => {
    const fetchPayouts = async () => {
      if (!appliedAgent) return // Wait for agent to be set

      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          setError("Not authenticated")
          return
        }

        const [monthsPast, monthsFuture] = appliedDateRange
        const params = new URLSearchParams()
        params.append('months_past', Math.abs(monthsPast).toString())
        params.append('months_future', monthsFuture.toString())
        params.append('agent_id', appliedAgent)

        if (appliedCarrier !== "all") {
          params.append('carrier_id', appliedCarrier)
        }

        const response = await fetch(`/api/expected-payouts?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Expected payouts API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          })
          throw new Error(errorData.error || errorData.message || 'Failed to fetch expected payouts')
        }

        const data = await response.json()
        setPayouts(data.payouts || [])
      } catch (err) {
        console.error('Error fetching payouts:', err)
        setError(err instanceof Error ? err.message : 'Failed to load payouts')
      } finally {
        setLoading(false)
      }
    }

    fetchPayouts()
  }, [appliedDateRange, appliedCarrier, appliedAgent])

  // Apply filters handler
  const handleApplyFilters = () => {
    setAppliedDateRange(tempDateRange)
    setAppliedCarrier(tempCarrier)
    setAppliedAgent(tempAgent)
  }

  // Aggregate data by month for chart
  const monthlyTotals = payouts.reduce((acc, payout) => {
    const monthKey = payout.month

    if (!acc[monthKey]) {
      acc[monthKey] = 0
    }
    acc[monthKey] += payout.expected_payout

    return acc
  }, {} as Record<string, number>)

  // Convert to array and sort by date
  const chartData = Object.entries(monthlyTotals)
    .map(([month, totalPayout]) => ({
      month: new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      monthDate: new Date(month), // Keep for sorting
      totalPayout
    }))
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
        <h1 className="text-4xl font-bold text-gradient mb-2">Expected Payouts</h1>
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
                value={tempAgent}
                onValueChange={setTempAgent}
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
                value={tempCarrier}
                onValueChange={setTempCarrier}
                placeholder="All Carriers"
                searchPlaceholder="Search carriers..."
              />
            </div>

            {/* Combined Date Range Slider */}
            <div className="flex-[2] min-w-[280px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Date Range:{" "}
                {tempDateRange[0] === 0 ? (
                  <span className="text-foreground font-semibold">Now</span>
                ) : (
                  <span className="text-foreground font-semibold">{Math.abs(tempDateRange[0])}m past</span>
                )}{" "}
                to{" "}
                {tempDateRange[1] === 0 ? (
                  <span className="text-foreground font-semibold">Now</span>
                ) : (
                  <span className="text-foreground font-semibold">{tempDateRange[1]}m future</span>
                )}
              </label>
              <Slider
                value={tempDateRange}
                onValueChange={(value) => setTempDateRange(value as [number, number])}
                min={-12}
                max={12}
                step={1}
                minStepsBetweenThumbs={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>-12m</span>
                <span className="text-foreground font-medium">Now</span>
                <span>+12m</span>
              </div>
            </div>

            {/* Filter Button */}
            <button
              onClick={handleApplyFilters}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium whitespace-nowrap"
            >
              Apply Filters
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="professional-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expected Payout</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalExpectedPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {payouts.length} deals
            </p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Per Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${averagePerMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {uniqueMonths} months
            </p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payouts.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending & active policies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="professional-card">
        <CardHeader>
          <CardTitle>Expected Payouts Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading chart data...</p>
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
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Expected Payout"
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
