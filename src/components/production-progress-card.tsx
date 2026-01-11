"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"

const ANNUAL_GOAL = 400000 // $400,000 per year

interface ProductionProgressCardProps {
  viewMode: 'just_me' | 'downlines'
  ytdProduction: { individual: number; hierarchy: number }
  mtdProduction: { individual: number; hierarchy: number }
  loading?: boolean
}

export function ProductionProgressCard({
  viewMode,
  ytdProduction,
  mtdProduction,
  loading = false
}: ProductionProgressCardProps) {
  const [periodMode, setPeriodMode] = useState<'ytd' | 'mtd'>('ytd')

  // Get the appropriate production value based on view mode and period
  const production = periodMode === 'ytd'
    ? (viewMode === 'just_me' ? ytdProduction.individual : ytdProduction.hierarchy)
    : (viewMode === 'just_me' ? mtdProduction.individual : mtdProduction.hierarchy)

  const goal = ANNUAL_GOAL // Always show progress against $400K
  const rawPercentage = (production / goal) * 100
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-foreground" />
            <span>Production Progress</span>
          </CardTitle>

          {/* YTD/MTD Toggle */}
          <div className="relative bg-muted/50 p-1 rounded-lg">
            <div
              className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-200 ease-in-out"
              style={{
                left: periodMode === 'ytd' ? '4px' : 'calc(50%)',
                width: 'calc(50% - 4px)'
              }}
            />
            <div className="relative z-10 flex">
              <button
                onClick={() => setPeriodMode('ytd')}
                className={`relative z-10 py-1.5 px-3 rounded-md text-sm font-medium transition-colors duration-200 ${
                  periodMode === 'ytd'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                YTD
              </button>
              <button
                onClick={() => setPeriodMode('mtd')}
                className={`relative z-10 py-1.5 px-3 rounded-md text-sm font-medium transition-colors duration-200 ${
                  periodMode === 'mtd'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                MTD
              </button>
            </div>
          </div>
        </div>
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
                  {formatCompactCurrency(production)}
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold text-foreground">
                  {formatCompactCurrency(production)}
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
              {formatCurrency(production)} of {formatCurrency(goal)} goal
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
