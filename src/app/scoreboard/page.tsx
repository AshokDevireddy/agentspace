"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/providers/AuthProvider"

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
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ScoreboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<TimeframeOption>('this_week')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectingStartDate, setSelectingStartDate] = useState(true)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())

  // Calculate date range based on timeframe
  const getDateRange = (selectedTimeframe: TimeframeOption): { startDate: string, endDate: string } => {
    const today = new Date()
    const year = today.getFullYear()
    let startDate: Date
    let endDate: Date = new Date(today)

    switch (selectedTimeframe) {
      case 'this_week': {
        const dayOfWeek = today.getDay()
        startDate = new Date(today)
        startDate.setDate(today.getDate() - dayOfWeek)
        endDate = new Date(today)
        endDate.setDate(today.getDate() + (6 - dayOfWeek))
        break
      }
      case 'last_week': {
        const dayOfWeek = today.getDay()
        endDate = new Date(today)
        endDate.setDate(today.getDate() - dayOfWeek - 1)
        startDate = new Date(endDate)
        startDate.setDate(endDate.getDate() - 6)
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
        startDate = new Date(year, today.getMonth(), 1)
        endDate = new Date(year, today.getMonth() + 1, 0)
        break
      case 'last_month':
        startDate = new Date(year, today.getMonth() - 1, 1)
        endDate = new Date(year, today.getMonth(), 0)
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
        startDate.setFullYear(today.getFullYear() - 1)
        break
      case 'ytd':
        startDate = new Date(year, 0, 1)
        break
      case 'custom':
        return {
          startDate: customStartDate || today.toISOString().split('T')[0],
          endDate: customEndDate || today.toISOString().split('T')[0]
        }
      default: {
        const dayOfWeek = today.getDay()
        startDate = new Date(today)
        startDate.setDate(today.getDate() - dayOfWeek)
        endDate = new Date(today)
        endDate.setDate(today.getDate() + (6 - dayOfWeek))
        break
      }
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  }

  useEffect(() => {
    if (timeframe !== 'custom') {
      const dateRange = getDateRange(timeframe)
      setCustomStartDate(dateRange.startDate)
      setCustomEndDate(dateRange.endDate)
    }
  }, [timeframe])

  useEffect(() => {
    const fetchScoreboardData = async () => {
      try {
        setLoading(true)
        const dateRange = getDateRange(timeframe)
        const params = new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        })
        const response = await fetch(`/api/scoreboard?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to fetch scoreboard data')
        }

        const result = await response.json()

        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to load scoreboard')
        }
      } catch (err) {
        console.error('Error fetching scoreboard:', err)
        setError('Failed to load scoreboard data')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      if (timeframe === 'custom' && (!customStartDate || !customEndDate)) {
        return
      }
      fetchScoreboardData()
    }
  }, [user, timeframe, customStartDate, customEndDate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading scoreboard...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-destructive">{error || 'No data available'}</div>
      </div>
    )
  }

  const topAgents = data.leaderboard.slice(0, 3)

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

  const sortedDates = generateDateRange(data.dateRange.startDate, data.dateRange.endDate)

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient mb-2">Scoreboard</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>{getTimeframeLabel()}</span>
            <span>•</span>
            <span>{formatDateRange(data.dateRange.startDate, data.dateRange.endDate)}</span>
          </div>

          <div className="flex items-center gap-3">
            <Select value={timeframe} onValueChange={(value) => setTimeframe(value as TimeframeOption)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
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
          </div>
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Production</h3>
            <p className="text-3xl font-bold text-primary">{formatCurrency(data.stats.totalProduction)}</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Policies Sold</h3>
            <p className="text-3xl font-bold text-green-400">{data.stats.totalDeals}</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Agents</h3>
            <p className="text-3xl font-bold text-blue-400">{data.stats.activeAgents}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Winners */}
      {topAgents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topAgents.map((agent, index) => (
            <Card key={agent.agent_id} className="professional-card relative overflow-hidden">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  <span className="text-4xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{agent.name}</h3>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(agent.total)}</p>
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
      <Card className="professional-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">Production Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {data.leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deals found for this period
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-0">Rank</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-[80px]">Name</th>
                    {sortedDates.map(date => (
                      <th key={date} className="text-center py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                        {formatDateHeader(date)}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground sticky right-0">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((agent, index) => (
                    <tr key={agent.agent_id} className={`border-b border-border hover:bg-accent/50 transition-colors ${index < 3 ? 'bg-primary/10' : ''}`}>
                      <td className="py-3 px-4 sticky left-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-foreground">{agent.rank}</span>
                          {index < 3 && (
                            <span className={`text-lg ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-500'}`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground sticky left-[80px] whitespace-nowrap">{agent.name}</td>
                      {sortedDates.map(date => (
                        <td key={date} className="py-3 px-4 text-center text-foreground whitespace-nowrap">
                          {agent.dailyBreakdown[date]
                            ? formatCurrency(agent.dailyBreakdown[date])
                            : '--'}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right font-bold text-green-400 sticky right-0 whitespace-nowrap">
                        {formatCurrency(agent.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}