"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-6 bg-muted rounded w-20"></div>
            </div>
            <div className="flex justify-center my-4">
              <div className="h-32 w-32 rounded-full bg-muted"></div>
            </div>
            <div className="h-4 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-4">
        {/* Header with toggle */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm font-medium text-muted-foreground">
              Production
            </p>
          </div>

          {/* YTD/MTD Toggle */}
          <div className="relative bg-muted/50 p-0.5 rounded-md">
            <div
              className="absolute top-0.5 bottom-0.5 bg-primary rounded transition-all duration-200 ease-in-out"
              style={{
                left: periodMode === 'ytd' ? '2px' : 'calc(50%)',
                width: 'calc(50% - 2px)'
              }}
            />
            <div className="relative z-10 flex">
              <button
                onClick={() => setPeriodMode('ytd')}
                className={`relative z-10 py-1 px-2 rounded text-xs font-medium transition-colors duration-200 ${
                  periodMode === 'ytd'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                YTD
              </button>
              <button
                onClick={() => setPeriodMode('mtd')}
                className={`relative z-10 py-1 px-2 rounded text-xs font-medium transition-colors duration-200 ${
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

        {/* Circular Progress */}
        <div className="relative flex justify-center items-center">
          <div className="w-36 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={65}
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
                <span className="text-2xl font-bold text-foreground">
                  {displayPercentage !== null ? `${displayPercentage.toFixed(0)}%` : '0%'}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCompactCurrency(production)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-bold text-foreground">
                  {formatCompactCurrency(production)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Total
                </span>
              </>
            )}
          </div>
        </div>

        {/* Goal text or label */}
        <div className="text-center mt-2">
          {viewMode === 'just_me' ? (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(production)} of {formatCurrency(goal)} goal
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Downline Production
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
