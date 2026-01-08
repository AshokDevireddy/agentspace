"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingUp } from "lucide-react"

const ANNUAL_GOAL = 400000 // $400,000 per year
const MONTHLY_GOAL = ANNUAL_GOAL / 12 // ~$33,333 per month

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

  const goal = periodMode === 'ytd' ? ANNUAL_GOAL : MONTHLY_GOAL
  const percentage = viewMode === 'just_me' ? Math.min((production / goal) * 100, 100) : 100
  const displayPercentage = viewMode === 'just_me' ? (production / goal) * 100 : null

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  if (loading) {
    return (
      <Card className="professional-card rounded-md">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="professional-card rounded-md transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="w-full overflow-hidden min-w-0">
            {/* Header with toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-sm font-medium text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1vw + 0.5rem, 0.875rem)' }}>
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

            {/* Production Amount */}
            <p className="font-bold text-foreground break-words leading-tight transition-all duration-300 mb-2" style={{ fontSize: 'clamp(1rem, 1.2vw + 0.75rem, 1.5rem)' }}>
              {formatCurrency(production)}
            </p>

            {/* Progress Bar */}
            <Progress
              value={percentage}
              className={`h-2 mb-2 ${
                viewMode === 'just_me'
                  ? 'bg-blue-100 [&>div]:bg-blue-600'
                  : 'bg-green-100 [&>div]:bg-green-600'
              }`}
            />

            {/* Goal text or label */}
            {viewMode === 'just_me' ? (
              <p className="text-xs text-muted-foreground">
                {displayPercentage !== null && displayPercentage > 100
                  ? `${displayPercentage.toFixed(1)}% of ${formatCurrency(goal)} goal`
                  : `${displayPercentage?.toFixed(1)}% of ${formatCurrency(goal)} goal`
                }
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Total Downline Production
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
