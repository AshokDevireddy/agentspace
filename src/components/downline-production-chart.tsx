"use client"

import React from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Home } from "lucide-react"

// Types for the RPC response
interface DownlineProductionData {
  agent_id: string
  agent_name: string
  total_production: number
  is_clickable: boolean
  has_downlines: boolean
}

interface BreadcrumbItem {
  agentId: string
  agentName: string
}

export interface DownlineProductionChartHandle {
  reset: () => void
  getBreadcrumbInfo: () => { currentAgentName: string; breadcrumbs: BreadcrumbItem[]; isAtRoot: boolean }
  navigateToBreadcrumb: (index: number) => void // -1 for root, 0+ for breadcrumb index
}

interface DownlineProductionChartProps {
  userId: string
  timeWindow: "3" | "6" | "9" | "all"
  embedded?: boolean // If true, skip Card wrapper and title
  onTitleChange?: (title: string) => void // Callback to get the current title when embedded
  onBreadcrumbChange?: (info: { currentAgentName: string; breadcrumbs: BreadcrumbItem[]; isAtRoot: boolean }) => void // Callback for breadcrumb changes
}

// Color palette for pie slices
const COLORS = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
  "#a855f7", // purple-500
]

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const angleDiff = endAngle - startAngle
  if (Math.abs(angleDiff) >= 360 || Math.abs(angleDiff - 360) < 0.001) {
    const start = polarToCartesian(cx, cy, r, startAngle)
    const midPoint = polarToCartesian(cx, cy, r, startAngle + 180)
    return [`M ${start.x} ${start.y}`, `A ${r} ${r} 0 1 0 ${midPoint.x} ${midPoint.y}`, `A ${r} ${r} 0 1 0 ${start.x} ${start.y}`, `L ${cx} ${cy}`, "Z"].join(" ")
  }
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = angleDiff <= 180 ? 0 : 1
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`, "Z"].join(" ")
}

function numberWithCommas(n: number) {
  return n.toLocaleString()
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

const DownlineProductionChart = React.forwardRef<DownlineProductionChartHandle, DownlineProductionChartProps>(
  ({ userId, timeWindow, embedded = false, onTitleChange, onBreadcrumbChange }, ref) => {
  const [data, setData] = React.useState<DownlineProductionData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [currentAgentId, setCurrentAgentId] = React.useState<string>(userId)
  const [currentAgentName, setCurrentAgentName] = React.useState<string>("You")
  const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbItem[]>([])
  const [hoverInfo, setHoverInfo] = React.useState<{
    x: number
    y: number
    agentName: string
    production: number
    percentage: number
    isClickable: boolean
    hasDownlines: boolean
  } | null>(null)

  // Calculate date range based on time window
  const getDateRange = React.useCallback(() => {
    const endDate = new Date()
    let startDate: Date | null = null

    if (timeWindow !== "all") {
      startDate = new Date()
      startDate.setMonth(startDate.getMonth() - parseInt(timeWindow))
    }

    return {
      startDate: startDate ? startDate.toISOString().split('T')[0] : null,
      endDate: endDate.toISOString().split('T')[0]
    }
  }, [timeWindow])

  // Fetch downline production data
  const fetchData = React.useCallback(async (agentId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { startDate, endDate } = getDateRange()

      console.log('[DownlineProductionChart] Fetching data with params:', {
        p_agent_id: agentId,
        p_start_date: startDate,
        p_end_date: endDate
      })

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_downline_production_distribution',
        {
          p_agent_id: agentId,
          p_start_date: startDate,
          p_end_date: endDate
        }
      )

      console.log('[DownlineProductionChart] RPC Response:', {
        data: rpcData,
        error: rpcError,
        errorDetails: rpcError ? {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        } : null
      })

      if (rpcError) {
        console.error('[DownlineProductionChart] RPC Error Full Details:', JSON.stringify(rpcError, null, 2))
        setError(`Failed to load downline production data: ${rpcError.message || 'Unknown error'}`)
        setData([])
        return
      }

      console.log('[DownlineProductionChart] Successfully fetched data:', rpcData)
      setData(rpcData || [])
    } catch (err) {
      console.error('[DownlineProductionChart] Fetch error:', err)
      console.error('[DownlineProductionChart] Error stack:', err instanceof Error ? err.stack : 'No stack trace')
      setError(`An error occurred while fetching data: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setData([])
    } finally {
      setIsLoading(false)
    }
  }, [getDateRange])

  // Initial load
  React.useEffect(() => {
    fetchData(userId)
  }, [userId, fetchData])

  // Refetch when time window changes
  React.useEffect(() => {
    fetchData(currentAgentId)
  }, [timeWindow, currentAgentId, fetchData])

  // Handle slice click
  const handleSliceClick = async (agentId: string, agentName: string, isClickable: boolean) => {
    if (!isClickable) {
      setError('Agent not in downline - cannot drill down')
      setTimeout(() => setError(null), 3000)
      return
    }

    // Add current level to breadcrumbs before drilling down (but not if we're at root "You")
    if (currentAgentId !== userId) {
      setBreadcrumbs([...breadcrumbs, { agentId: currentAgentId, agentName: currentAgentName }])
    }

    // Set the new current agent
    setCurrentAgentId(agentId)
    setCurrentAgentName(agentName)
  }

  // Reset function to expose to parent
  const resetToRoot = React.useCallback(() => {
    setCurrentAgentId(userId)
    setCurrentAgentName("You")
    setBreadcrumbs([])
  }, [userId])

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = React.useCallback((index: number) => {
    if (index === -1) {
      // Reset to root
      resetToRoot()
    } else {
      const targetBreadcrumb = breadcrumbs[index]
      setCurrentAgentId(targetBreadcrumb.agentId)
      setCurrentAgentName(targetBreadcrumb.agentName)
      setBreadcrumbs(breadcrumbs.slice(0, index))
    }
  }, [breadcrumbs, resetToRoot])

  // Expose reset function and breadcrumb info via ref
  React.useImperativeHandle(ref, () => ({
    reset: resetToRoot,
    getBreadcrumbInfo: () => ({
      currentAgentName,
      breadcrumbs,
      isAtRoot: currentAgentId === userId
    }),
    navigateToBreadcrumb: handleBreadcrumbClick
  }), [resetToRoot, currentAgentName, breadcrumbs, currentAgentId, userId, handleBreadcrumbClick])

  // Calculate wedges for pie chart
  const wedges = React.useMemo(() => {
    if (data.length === 0) return []

    const total = data.reduce((sum, item) => sum + Number(item.total_production), 0)

    if (total === 0) return []

    let currentAngle = 0
    return data.map((item, idx) => {
      const percentage = (Number(item.total_production) / total) * 100
      const angle = (percentage / 100) * 360
      const wedge = {
        agentId: item.agent_id,
        agentName: item.agent_name,
        production: Number(item.total_production),
        percentage: Math.round(percentage * 10) / 10,
        isClickable: item.is_clickable && item.has_downlines, // Only clickable if in downline AND has downlines
        hasDownlines: item.has_downlines,
        color: COLORS[idx % COLORS.length],
        startAngle: currentAngle,
        endAngle: currentAngle + angle
      }
      currentAngle += angle
      return wedge
    })
  }, [data])

  // Display name for title
  const displayName = currentAgentId === userId ? "Your" : currentAgentName + "'s"
  const titleText = `${displayName} Direct Downline Distribution`

  // Notify parent of title change when embedded
  React.useEffect(() => {
    if (embedded && onTitleChange && !isLoading) {
      onTitleChange(titleText)
    }
  }, [embedded, onTitleChange, titleText, isLoading])

  // Notify parent of breadcrumb change when embedded
  React.useEffect(() => {
    if (embedded && onBreadcrumbChange && !isLoading) {
      onBreadcrumbChange({
        currentAgentName,
        breadcrumbs,
        isAtRoot: currentAgentId === userId
      })
    }
  }, [embedded, onBreadcrumbChange, currentAgentName, breadcrumbs, currentAgentId, userId, isLoading])

  const content = (
    <>
      {/* Breadcrumb Navigation - only show Back button when not embedded, Reset button moved below */}
      {!isLoading && breadcrumbs.length > 0 && !embedded && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleBreadcrumbClick(breadcrumbs.length - 2)}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <span>Back</span>
          </Button>
        </div>
      )}

      {/* Breadcrumb trail - only visible when not embedded */}
      {!isLoading && !embedded && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span
            onClick={() => handleBreadcrumbClick(-1)}
            className="cursor-pointer hover:text-foreground transition-colors"
          >
            You
          </span>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.agentId}>
              <span>→</span>
              <span
                onClick={() => handleBreadcrumbClick(idx)}
                className="cursor-pointer hover:text-foreground transition-colors"
              >
                {crumb.agentName}
              </span>
            </React.Fragment>
          ))}
          {currentAgentId !== userId && (
            <>
              <span>→</span>
              <span className="font-medium text-foreground">
                {currentAgentName}
              </span>
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Chart Content - always has consistent structure */}
      <div className="flex flex-col items-center justify-center gap-6">
          {isLoading ? (
            <>
              {/* Title skeleton */}
              <div className="h-5 w-64 bg-muted animate-pulse rounded" />

              {/* Pie Chart skeleton */}
              <div className="relative h-[320px] w-[320px]">
                <div className="h-full w-full rounded-full bg-muted animate-pulse" />
              </div>

              {/* Legend skeleton */}
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                <div className="h-4 w-44 bg-muted animate-pulse rounded" />
              </div>
            </>
          ) : wedges.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center">
              <div className="text-sm text-muted-foreground">No data available</div>
            </div>
          ) : (
            <>
              {/* Title - only show when not embedded */}
              {!embedded && (
                <div className="text-center text-sm font-medium">
                  {displayName} Direct Downline Distribution
                </div>
              )}

              {/* Pie Chart */}
              <div className="relative h-[320px] w-[320px]">
              <svg width={320} height={320} viewBox="0 0 320 320" className="overflow-visible">
                <defs>
                  <filter id="shadow-downline" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
                  </filter>
                  <filter id="darken-downline">
                    <feColorMatrix type="matrix" values="0.7 0 0 0 0 0 0.7 0 0 0 0 0 0.7 0 0 0 0 0 1 0"/>
                  </filter>
                </defs>
                <g filter="url(#shadow-downline)">
                  {wedges.map((wedge, idx) => {
                    const path = describeArc(160, 160, 150, wedge.startAngle, wedge.endAngle)
                    const mid = (wedge.startAngle + wedge.endAngle) / 2
                    const center = polarToCartesian(160, 160, 90, mid)
                    const isHovered = hoverInfo?.agentName === wedge.agentName
                    const isOtherHovered = hoverInfo !== null && !isHovered

                    return (
                      <path
                        key={wedge.agentId}
                        d={path}
                        fill={wedge.color}
                        stroke="#fff"
                        strokeWidth={2}
                        opacity={isOtherHovered ? 0.4 : wedge.isClickable ? 1 : 0.6}
                        filter={isHovered ? "url(#darken-downline)" : undefined}
                        style={{
                          transform: isHovered ? "scale(1.02)" : "scale(1)",
                          transformOrigin: "160px 160px",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          cursor: wedge.isClickable ? "pointer" : "not-allowed",
                        }}
                        onMouseEnter={() => setHoverInfo({
                          x: center.x,
                          y: center.y,
                          agentName: wedge.agentName,
                          production: wedge.production,
                          percentage: wedge.percentage,
                          isClickable: wedge.isClickable,
                          hasDownlines: wedge.hasDownlines,
                        })}
                        onMouseLeave={() => setHoverInfo(null)}
                        onClick={() => handleSliceClick(wedge.agentId, wedge.agentName, wedge.isClickable)}
                      />
                    )
                  })}
                </g>
              </svg>

              {/* Hover Tooltip */}
              {hoverInfo && (
                <div
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10"
                  style={{ left: hoverInfo.x, top: hoverInfo.y }}
                >
                  <div className="mb-1 text-sm font-semibold">{hoverInfo.agentName}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-white/80" />
                      <span>{formatCurrency(hoverInfo.production)} Production</span>
                    </div>
                    <div className="text-white/90">{hoverInfo.percentage}% of Total</div>
                    {hoverInfo.isClickable ? (
                      <div className="mt-2 text-[10px] italic text-white/70">Click to drill down</div>
                    ) : !hoverInfo.hasDownlines ? (
                      <div className="mt-2 text-[10px] italic text-gray-400">No downline data</div>
                    ) : (
                      <div className="mt-2 text-[10px] italic text-red-300">Agent not in current downline</div>
                    )}
                  </div>
                </div>
              )}
            </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {wedges.map((wedge) => (
                  <div
                    key={wedge.agentId}
                    className={`flex items-center gap-2 text-sm ${!wedge.isClickable ? 'opacity-60' : ''}`}
                  >
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: wedge.color }}
                    />
                    <span>
                      {wedge.agentName} - {formatCurrency(wedge.production)} ({wedge.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      {/* Reset Button - shown below legend when embedded */}
      {embedded && !isLoading && (breadcrumbs.length > 0 || currentAgentId !== userId) && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleBreadcrumbClick(-1)}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            <span>Reset</span>
          </Button>
        </div>
      )}
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <Card className="rounded-md">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">
          DOWNLINE PRODUCTION DISTRIBUTION
        </div>
        {content}
      </CardContent>
    </Card>
  )
})

DownlineProductionChart.displayName = "DownlineProductionChart"

export default DownlineProductionChart
