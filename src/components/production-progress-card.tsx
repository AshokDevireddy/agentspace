"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { type TimePeriod } from "@/lib/date-utils"

const ANNUAL_GOAL = 400000 // $400,000 per year

interface ProductionProgressCardProps {
  viewMode: 'just_me' | 'downlines'
  production: { individual: number; hierarchy: number }
  timePeriod: TimePeriod
  loading?: boolean
}

// Calculate pro-rated goal based on time period
function getProRatedGoal(period: TimePeriod): number {
  switch (period) {
    case 'ytd': return ANNUAL_GOAL
    case 'this_month': return ANNUAL_GOAL / 12
    case 'this_week': return ANNUAL_GOAL / 52
  }
}

export function ProductionProgressCard({
  viewMode,
  production,
  timePeriod,
  loading = false
}: ProductionProgressCardProps) {
  // Get the appropriate production value based on view mode
  const productionValue = viewMode === 'just_me' ? production.individual : production.hierarchy

  const goal = getProRatedGoal(timePeriod)
  const rawPercentage = (productionValue / goal) * 100
  const displayPercentage = viewMode === 'just_me' ? rawPercentage : null
  const chartPercentage = viewMode === 'just_me' ? Math.min(rawPercentage, 100) : 100

  // Colors based on view mode
  const progressColor = viewMode === 'just_me' ? '#2563eb' : '#16a34a' // blue-600 / green-600
  const trackColor = viewMode === 'just_me' ? '#dbeafe' : '#dcfce7' // blue-100 / green-100

  // Data for the donut chart
  const chartData = [
    { name: 'progress', value: chartPercentage },
    { name: 'remaining', value: 100 - chartPercentage }
  ]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return formatCurrency(value)
  }

  if (loading) {
    return (
      <Card className="professional-card rounded-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="h-6 bg-muted rounded w-32 animate-pulse"></div>
            <div className="h-8 bg-muted rounded w-24 animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="h-64 w-64 rounded-full bg-muted animate-pulse"></div>
          </div>
          <div className="h-5 bg-muted rounded w-48 mx-auto animate-pulse"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-foreground" />
          <span>Production Progress</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Large Circular Progress */}
        <div className="relative flex justify-center items-center py-4">
          <div className="w-64 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={90}
                  outerRadius={115}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={true}
                  animationDuration={500}
                >
                  <Cell fill={progressColor} />
                  <Cell fill={trackColor} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {viewMode === 'just_me' ? (
              <>
                <span className="text-4xl font-bold text-foreground">
                  {displayPercentage !== null ? `${displayPercentage.toFixed(0)}%` : '0%'}
                </span>
                <span className="text-xl font-semibold text-foreground mt-1">
                  {formatCompactCurrency(productionValue)}
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold text-foreground">
                  {formatCompactCurrency(productionValue)}
                </span>
                <span className="text-sm text-muted-foreground mt-1">
                  Total Production
                </span>
              </>
            )}
          </div>
        </div>

        {/* Goal text or label */}
        <div className="text-center">
          {viewMode === 'just_me' ? (
            <p className="text-sm text-muted-foreground">
              {formatCurrency(productionValue)} of {formatCurrency(goal)} goal
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Downline Production
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
