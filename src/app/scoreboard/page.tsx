"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, Info } from "lucide-react"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { useScoreboardBillingCycleData } from "@/hooks/useDashboardData"
import { queryKeys } from "@/hooks/queryKeys"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAgencyScoreboardSettings } from "@/hooks/useUserQueries"
import { QueryErrorDisplay } from "@/components/ui/query-error-display"
import { RefreshingIndicator } from "@/components/ui/refreshing-indicator"
import { useHydrated } from "@/hooks/useHydrated"
import { useClientDate } from "@/hooks/useClientDate"

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

interface ScoreboardRpcResponse {
  success: boolean
  data?: ScoreboardData
  error?: string
}

type TimeframeOption = 'this_week' | 'last_week' | 'past_7_days' | 'past_14_days' | 'this_month' | 'last_month' | 'past_30_days' | 'past_90_days' | 'past_180_days' | 'past_12_months' | 'ytd' | 'custom'

const timeframeOptions = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'past_7_days', label: 'Past 7 Days' },
  { value: 'past_14_days', label: 'Past 14 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'past_30_days', label: 'Past 30 Days' },
  { value: 'past_90_days', label: 'Past 90 Days' },
  { value: 'past_180_days', label: 'Past 180 Days' },
  { value: 'past_12_months', label: 'Past 12 Months' },
  { value: 'ytd', label: 'YTD' },
  { value: 'custom', label: 'Custom' }
]

export default function Scoreboard() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  // SSR-safe hydration and date hooks
  const isHydrated = useHydrated()
  const clientDate = useClientDate()

  const [timeframe, setTimeframe] = useState<TimeframeOption>('this_month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectingStartDate, setSelectingStartDate] = useState(true)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  // SSR-safe: Initialize with clientDate values (deterministic on server, actual on client)
  const [calendarMonth, setCalendarMonth] = useState(clientDate.month)
  const [calendarYear, setCalendarYear] = useState(clientDate.year)
  const [assumedMonthsTillLapse, setAssumedMonthsTillLapse] = useState<number>(5)
  const [assumedMonthsInput, setAssumedMonthsInput] = useState<string>('5')
  const [showAssumedMonthsTooltip, setShowAssumedMonthsTooltip] = useState(false)
  const [submittedFilter, setSubmittedFilter] = useState<'submitted' | 'issue_paid'>('submitted')
  const [viewMode, setViewMode] = useState<'agency' | 'my_team'>('agency')

  // Fetch downline IDs for My Team filter
  const { data: downlineData } = useQuery({
    queryKey: queryKeys.myDownlineIds(user?.id || ''),
    queryFn: async () => {
      const response = await fetch(`/api/agents/downlines?agentId=${user?.id}`, {
        credentials: 'include'
      })
      if (!response.ok) return { downlineIds: [] as string[] }
      const data = await response.json()
      const ids: string[] = (data.downlines || data || []).map((d: { id: string }) => d.id)
      return { downlineIds: ids }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Update calendar state when client date becomes available after hydration
  useEffect(() => {
    if (isHydrated) {
      setCalendarMonth(clientDate.month)
      setCalendarYear(clientDate.year)
    }
  }, [isHydrated, clientDate.month, clientDate.year])

  // Fetch agency default scoreboard start date using TanStack Query
  const { data: agencySettings } = useAgencyScoreboardSettings(user?.agency_id)
  const defaultScoreboardStartDate = agencySettings?.default_scoreboard_start_date ?? null

  // Calculate date range based on timeframe - SSR-safe using clientDate
  const getDateRange = useCallback((selectedTimeframe: TimeframeOption): { startDate: string, endDate: string } => {
    const { date: today, year, month, dayOfWeek } = clientDate
    let startDate: Date
    let endDate: Date = new Date(today)

    switch (selectedTimeframe) {
      case 'this_week': {
        // Monday to Sunday week
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        startDate = new Date(today)
        startDate.setDate(today.getDate() - daysFromMonday)
        startDate.setHours(0, 0, 0, 0)
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
        endDate = new Date(today)
        endDate.setDate(today.getDate() + daysToSunday)
        endDate.setHours(23, 59, 59, 999)
        break
      }
      case 'last_week': {
        // Last Monday to Sunday week
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const thisWeekMonday = new Date(today)
        thisWeekMonday.setDate(today.getDate() - daysFromMonday)
        startDate = new Date(thisWeekMonday)
        startDate.setDate(thisWeekMonday.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
        break
      }
      case 'past_7_days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 6)
        break
      case 'past_14_days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 13)
        break
      case 'this_month':
        startDate = new Date(year, month, 1)
        endDate = new Date(year, month + 1, 0)
        break
      case 'last_month':
        startDate = new Date(year, month - 1, 1)
        endDate = new Date(year, month, 0)
        break
      case 'past_30_days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 29)
        break
      case 'past_90_days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 89)
        break
      case 'past_180_days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 179)
        break
      case 'past_12_months':
        startDate = new Date(today)
        startDate.setFullYear(year - 1)
        break
      case 'ytd':
        startDate = new Date(year, 0, 1)
        break
      case 'custom':
        return {
          startDate: customStartDate || clientDate.isoDate,
          endDate: customEndDate || clientDate.isoDate
        }
      default: {
        // Monday to Sunday week
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
        startDate = new Date(today)
        startDate.setDate(today.getDate() - daysFromMonday)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(today)
        endDate.setDate(today.getDate() + daysToSunday)
        endDate.setHours(23, 59, 59, 999)
        break
      }
    }

    // Format dates in local timezone to avoid UTC conversion issues
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Use agency default start date if available and not null, but only when submitted filter is true
    const finalStartDate = (submittedFilter === 'submitted' && defaultScoreboardStartDate)
      ? defaultScoreboardStartDate
      : formatLocalDate(startDate)

    return {
      startDate: finalStartDate,
      endDate: formatLocalDate(endDate)
    }
  }, [clientDate, customStartDate, customEndDate, defaultScoreboardStartDate, submittedFilter])

  // Memoize the date range calculation to avoid unnecessary recalculations
  // SSR-safe: uses clientDate which returns deterministic values on server
  const dateRange = useMemo(() => {
    if (timeframe === 'custom') {
      // For custom dates, always use the user-selected dates directly
      // Never apply default_scoreboard_start_date to custom selections
      return {
        startDate: customStartDate || clientDate.isoDate,
        endDate: customEndDate || clientDate.isoDate
      }
    }
    return getDateRange(timeframe)
  }, [timeframe, customStartDate, customEndDate, getDateRange, clientDate.isoDate])

  // Update custom dates when timeframe changes (only for non-custom timeframes)
  useEffect(() => {
    if (timeframe !== 'custom') {
      const range = getDateRange(timeframe)
      setCustomStartDate(range.startDate)
      setCustomEndDate(range.endDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]) // Only update when timeframe changes, not when getDateRange changes (to avoid interfering with custom dates)

  // Fetch scoreboard data using TanStack Query
  const shouldFetch = !!user?.id && (timeframe !== 'custom' || (!!dateRange.startDate && !!dateRange.endDate))

  const { data: rpcResponse, isPending: isDataLoading, isFetching, error: queryError } = useScoreboardBillingCycleData(
    user?.id,
    dateRange.startDate,
    dateRange.endDate,
    'agency',
    {
      enabled: shouldFetch,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  )

  // Extract data and error from response
  const data = rpcResponse?.success ? rpcResponse.data : null
  const error = rpcResponse?.success === false ? rpcResponse.error : queryError?.message

  // Include authLoading to show skeletons while auth initializes (prevents "no data" flash)
  const isLoading = authLoading || isDataLoading

  // Background refresh indicator (stale-while-revalidate pattern)
  const isRefreshing = isFetching && !isDataLoading

  // Calculate date range for display even when loading
  const displayDateRange = useMemo(() => {
    if (data?.dateRange) {
      return data.dateRange
    }
    return {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    }
  }, [data, dateRange])

  // Filter leaderboard based on view mode (agency vs my team)
  const filteredLeaderboard = useMemo(() => {
    if (!data?.leaderboard) return []
    if (viewMode === 'agency') return data.leaderboard
    const myDownlineIds = new Set(downlineData?.downlineIds || [])
    if (user?.id) myDownlineIds.add(user.id)
    return data.leaderboard
      .filter(agent => myDownlineIds.has(agent.agent_id))
      .map((agent, index) => ({ ...agent, rank: index + 1 }))
  }, [data?.leaderboard, viewMode, downlineData?.downlineIds, user?.id])

  const filteredStats = useMemo(() => {
    if (viewMode === 'agency' || !data?.stats) return data?.stats || null
    return {
      totalProduction: filteredLeaderboard.reduce((sum, a) => sum + (a.total || 0), 0),
      totalDeals: filteredLeaderboard.reduce((sum, a) => sum + (a.dealCount || 0), 0),
      activeAgents: filteredLeaderboard.length,
    }
  }, [viewMode, data?.stats, filteredLeaderboard])

  const topAgents = filteredLeaderboard.slice(0, 3)

  // Generate all dates in the range
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = []
    const startDate = new Date(start + 'T00:00:00')
    const endDate = new Date(end + 'T00:00:00')

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return dates
  }

  const sortedDates = generateDateRange(displayDateRange.startDate, displayDateRange.endDate)

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

  const getTimeframeLabel = () => {
    return timeframeOptions.find(opt => opt.value === timeframe)?.label || 'This Week'
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Generate calendar days for a given month
  const generateCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (number | null)[] = []

    // Add empty cells for days before the first day of month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }

  const handleDateClick = (day: number) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (selectingStartDate || !customStartDate) {
      setCustomStartDate(dateStr)
      setCustomEndDate('')
      setSelectingStartDate(false)
    } else {
      // If clicking a date before start date, reset
      if (new Date(dateStr) < new Date(customStartDate)) {
        setCustomStartDate(dateStr)
        setCustomEndDate('')
      } else {
        setCustomEndDate(dateStr)
        setIsCalendarOpen(false)
        setSelectingStartDate(true)
        setTimeframe('custom')
      }
    }
  }

  const isDateInRange = (day: number) => {
    if (!customStartDate) return false
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const date = new Date(dateStr)
    const start = new Date(customStartDate)
    const end = customEndDate ? new Date(customEndDate) : (hoveredDate ? new Date(hoveredDate) : null)

    if (!end) return dateStr === customStartDate
    return date >= start && date <= end
  }

  const isDateStart = (day: number) => {
    if (!customStartDate) return false
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateStr === customStartDate
  }

  const isDateEnd = (day: number) => {
    if (!customEndDate) return false
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateStr === customEndDate
  }

  const calendarDays = generateCalendarDays(calendarYear, calendarMonth)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <div className="space-y-8 scoreboard-content" data-tour="scoreboard">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">Scoreboard</h1>
            <RefreshingIndicator isRefreshing={isRefreshing} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="10"
                step="1"
                value={assumedMonthsInput}
                onChange={(e) => {
                  const inputValue = e.target.value
                  // Update the input display value
                  setAssumedMonthsInput(inputValue)

                  // Parse and validate
                  if (inputValue === '') {
                    return // Allow empty while typing
                  }

                  const value = parseInt(inputValue, 10)
                  // Only update the actual state if it's a valid whole number between 1-10
                  if (!isNaN(value) && value >= 1 && value <= 10 && Number.isInteger(value)) {
                    setAssumedMonthsTillLapse(value)
                  }
                }}
                onBlur={(e) => {
                  const inputValue = e.target.value.trim()
                  if (inputValue === '') {
                    // If empty on blur, reset to default
                    setAssumedMonthsTillLapse(5)
                    setAssumedMonthsInput('5')
                    return
                  }

                  const value = parseInt(inputValue, 10)
                  // Reset to default if invalid
                  if (isNaN(value) || value < 1 || value > 10 || !Number.isInteger(value)) {
                    setAssumedMonthsTillLapse(5)
                    setAssumedMonthsInput('5')
                  } else {
                    // Ensure input display matches the validated value
                    setAssumedMonthsInput(value.toString())
                  }
                }}
                className="w-[60px] rounded-md h-9 text-sm"
                placeholder="5"
              />
              <div className="relative">
                <Info
                  className="h-3 w-3 text-muted-foreground cursor-help"
                  onMouseEnter={() => setShowAssumedMonthsTooltip(true)}
                  onMouseLeave={() => setShowAssumedMonthsTooltip(false)}
                />
                {showAssumedMonthsTooltip && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-64 p-2 bg-popover border border-border rounded-md shadow-lg text-xs text-popover-foreground z-50 pointer-events-none whitespace-normal">
                    Assumed Months Till Lapse: The assumed time how long policies remained active before lapsing (1-10 months)
                  </div>
                )}
              </div>
            </div>
            <div className="flex rounded-md overflow-hidden border border-border">
              <Button
                variant={viewMode === 'agency' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-9 text-sm"
                onClick={() => setViewMode('agency')}
              >
                Agency
              </Button>
              <Button
                variant={viewMode === 'my_team' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-9 text-sm"
                onClick={() => setViewMode('my_team')}
              >
                My Team
              </Button>
            </div>
            <Select value={timeframe} onValueChange={(value) => setTimeframe(value as TimeframeOption)}>
              <SelectTrigger className="w-[160px] rounded-md h-9 text-sm">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent className="rounded-md max-h-[300px]">
                {timeframeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStartDate && customEndDate ? (
                    <span>
                      {formatDisplayDate(customStartDate)} - {formatDisplayDate(customEndDate)}
                    </span>
                  ) : customStartDate ? (
                    <span>{formatDisplayDate(customStartDate)} - Select end date</span>
                  ) : (
                    <span className="text-muted-foreground">Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => {
                        if (calendarMonth === 0) {
                          setCalendarMonth(11)
                          setCalendarYear(calendarYear - 1)
                        } else {
                          setCalendarMonth(calendarMonth - 1)
                        }
                      }}
                      className="p-2 hover:bg-accent rounded"
                    >
                      ←
                    </button>
                    <div className="font-semibold">
                      {monthNames[calendarMonth]} {calendarYear}
                    </div>
                    <button
                      onClick={() => {
                        if (calendarMonth === 11) {
                          setCalendarMonth(0)
                          setCalendarYear(calendarYear + 1)
                        } else {
                          setCalendarMonth(calendarMonth + 1)
                        }
                      }}
                      className="p-2 hover:bg-accent rounded"
                    >
                      →
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((day, index) => {
                      if (day === null) {
                        return <div key={`empty-${index}`} />
                      }

                      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const isInRange = isDateInRange(day)
                      const isStart = isDateStart(day)
                      const isEnd = isDateEnd(day)

                      return (
                        <button
                          key={day}
                          onClick={() => handleDateClick(day)}
                          onMouseEnter={() => setHoveredDate(dateStr)}
                          onMouseLeave={() => setHoveredDate(null)}
                          className={`
                            p-2 text-sm rounded-md transition-colors
                            ${isStart || isEnd ? 'bg-primary text-primary-foreground font-semibold' : ''}
                            ${isInRange && !isStart && !isEnd ? 'bg-primary/20' : ''}
                            ${!isInRange && !isStart && !isEnd ? 'hover:bg-accent' : ''}
                          `}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-between mt-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomStartDate('')
                        setCustomEndDate('')
                        setSelectingStartDate(true)
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setIsCalendarOpen(false)
                        if (customStartDate && customEndDate) {
                          setTimeframe('custom')
                        }
                      }}
                      disabled={!customStartDate || !customEndDate}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={submittedFilter === 'submitted' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSubmittedFilter('submitted')}
                className="h-9 px-3 text-sm"
              >
                Submitted
              </Button>
              <Button
                variant={submittedFilter === 'issue_paid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSubmittedFilter('issue_paid')}
                className="h-9 px-3 text-sm"
              >
                Issue Paid
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
          <span>{getTimeframeLabel()}</span>
          <span>•</span>
          {isHydrated ? (
            <span>{formatDateRange(displayDateRange.startDate, displayDateRange.endDate)}</span>
          ) : (
            <span className="h-4 w-48 bg-muted animate-pulse rounded inline-block" />
          )}
        </div>
      </div>

      {/* Error state */}
      {queryError && (
        <div className="mb-6">
          <QueryErrorDisplay
            error={queryError}
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.scoreboard(user?.id || '', dateRange.startDate, dateRange.endDate) })}
            variant="card"
            title="Failed to load scoreboard data"
          />
        </div>
      )}

      {/* Weekly Stats - Only show for admins (after hydration to avoid mismatch) */}
      {isHydrated && user?.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="professional-card rounded-md">
            <CardContent className="p-6 text-center">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Production</h3>
              <p className="text-3xl font-bold text-foreground">
                {isLoading ? (
                  <span className="inline-block h-8 w-32 bg-muted animate-pulse rounded" />
                ) : (
                  formatCurrency(filteredStats?.totalProduction || 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="professional-card rounded-md">
            <CardContent className="p-6 text-center">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Policies Sold</h3>
              <p className="text-3xl font-bold text-foreground">
                {isLoading ? (
                  <span className="inline-block h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  filteredStats?.totalDeals || 0
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="professional-card rounded-md">
            <CardContent className="p-6 text-center">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Agents</h3>
              <p className="text-3xl font-bold text-foreground">
                {isLoading ? (
                  <span className="inline-block h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  filteredStats?.activeAgents || 0
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 3 Winners */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((index) => (
            <Card key={index} className="professional-card rounded-md relative overflow-hidden">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  <span className="text-4xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                </div>
                <div className="h-6 w-32 bg-muted animate-pulse rounded mx-auto mb-2" />
                <div className="h-8 w-40 bg-muted animate-pulse rounded mx-auto mb-2" />
                <div className="h-6 w-16 bg-muted animate-pulse rounded mx-auto mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : topAgents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topAgents.map((agent, index) => (
            <Card key={agent.agent_id} className="professional-card rounded-md relative overflow-hidden">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  <span className="text-4xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{agent.name}</h3>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(agent.total)}</p>
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
      <Card className="professional-card rounded-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">Production Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-0 bg-card z-10 w-20 min-w-[80px]" style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>Rank</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-[80px] bg-card z-10" style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>Name</th>
                    {/* Use fixed placeholder columns for loading skeleton to avoid hydration mismatch */}
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <th key={i} className="text-center py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                        <span className="h-4 w-10 bg-muted animate-pulse rounded inline-block" />
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground sticky right-0 bg-card z-10" style={{ boxShadow: '-2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <tr key={index} className="border-b border-border">
                      <td className="py-3 px-4 sticky left-0 bg-card z-10 w-20 min-w-[80px]" style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>
                        <div className="h-5 w-8 bg-muted animate-pulse rounded" />
                      </td>
                      <td className="py-3 px-4 sticky left-[80px] bg-card z-10" style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>
                        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                      </td>
                      {/* Use fixed placeholder columns for loading skeleton to avoid hydration mismatch */}
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <td key={i} className="py-3 px-4 text-center">
                          <div className="h-5 w-20 bg-muted animate-pulse rounded mx-auto" />
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right sticky right-0 bg-card z-10" style={{ boxShadow: '-2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>
                        <div className="h-5 w-24 bg-muted animate-pulse rounded ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : queryError ? (
            <QueryErrorDisplay
              error={queryError}
              onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.scoreboard(user?.id || '', dateRange.startDate, dateRange.endDate) })}
              variant="inline"
              className="mx-auto max-w-md"
            />
          ) : !data || filteredLeaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deals found for this period
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-0 bg-card z-10 w-20 min-w-[80px]" style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>Rank</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-[80px] bg-card z-10" style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>Name</th>
                    {sortedDates.map(date => (
                      <th key={date} className="text-center py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                        {formatDateHeader(date)}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground sticky right-0 bg-card z-10" style={{ boxShadow: '-2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.map((agent, index) => {
                    const rowBgClass = index < 3 ? 'bg-primary/10' : 'bg-card'
                    return (
                      <tr key={agent.agent_id} className={`border-b border-border hover:bg-accent/50 transition-colors ${index < 3 ? 'bg-primary/10' : ''}`}>
                        <td className={`py-3 px-4 sticky left-0 z-10 w-20 min-w-[80px] ${rowBgClass}`} style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-foreground">{agent.rank}</span>
                            {index < 3 && (
                              <span className={`text-lg ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-500'}`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`py-3 px-4 font-medium text-foreground sticky left-[80px] whitespace-nowrap z-10 ${rowBgClass}`} style={{ boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>{agent.name}</td>
                        {sortedDates.map(date => (
                          <td key={date} className="py-3 px-4 text-center text-foreground whitespace-nowrap">
                            {agent.dailyBreakdown[date]
                              ? formatCurrency(agent.dailyBreakdown[date])
                              : '--'}
                          </td>
                        ))}
                        <td className={`py-3 px-4 text-right font-bold text-foreground sticky right-0 whitespace-nowrap z-10 ${rowBgClass}`} style={{ boxShadow: '-2px 0 4px -2px rgba(0, 0, 0, 0.1)' }}>
                          {formatCurrency(agent.total)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
