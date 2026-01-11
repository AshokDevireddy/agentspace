"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useClientDate } from "@/hooks/useClientDate"

interface MonthRangePickerProps {
  startMonth: string // Format: "YYYY-MM"
  endMonth: string // Format: "YYYY-MM"
  onRangeChange: (startMonth: string, endMonth: string) => void
  disabled?: boolean
}

export function MonthRangePicker({ startMonth, endMonth, onRangeChange, disabled }: MonthRangePickerProps) {
  const [open, setOpen] = useState(false)
  // SSR-safe: useClientDate returns deterministic values on server, actual values on client
  const clientDate = useClientDate()
  // Initialize with 2025 to match useClientDate server default, then sync via useEffect
  const [displayYear, setDisplayYear] = useState(2025)
  const [selectingStart, setSelectingStart] = useState(true)
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)

  // Sync displayYear when clientDate becomes available (only on first render)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      setDisplayYear(clientDate.year)
    }
  }, [clientDate.year])

  // Parse the date strings
  const parseMonth = (monthStr: string) => {
    if (!monthStr) return null
    const [year, month] = monthStr.split('-')
    return { year: parseInt(year), month: parseInt(month) }
  }

  const startParsed = parseMonth(startMonth)
  const endParsed = parseMonth(endMonth)

  // Format display text
  const formatMonthDisplay = (monthStr: string) => {
    if (!monthStr) return ""
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1) // Use local timezone constructor
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const displayText = startMonth && endMonth
    ? `${formatMonthDisplay(startMonth)} - ${formatMonthDisplay(endMonth)}`
    : "Select date range"

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ]

  const handleMonthClick = (year: number, monthIndex: number) => {
    const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`

    if (selectingStart) {
      // First selection - set start month
      onRangeChange(monthStr, monthStr)
      setSelectingStart(false)
    } else {
      // Second selection - set end month
      const newStart = startMonth
      const newEnd = monthStr

      // Ensure start is before end
      if (newStart <= newEnd) {
        onRangeChange(newStart, newEnd)
      } else {
        onRangeChange(newEnd, newStart)
      }
      setSelectingStart(true)
      setOpen(false) // Close after range selection
    }
  }

  const isMonthSelected = (year: number, monthIndex: number) => {
    const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    return monthStr === startMonth || monthStr === endMonth
  }

  const isMonthInRange = (year: number, monthIndex: number) => {
    if (!startMonth || !endMonth) return false
    const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    return monthStr >= startMonth && monthStr <= endMonth
  }

  const isMonthHovered = (year: number, monthIndex: number) => {
    if (!hoveredMonth || !startMonth || selectingStart) return false
    const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    // String comparison works for "YYYY-MM" format (lexicographic order)
    const minMonth = startMonth < hoveredMonth ? startMonth : hoveredMonth
    const maxMonth = startMonth > hoveredMonth ? startMonth : hoveredMonth
    return monthStr >= minMonth && monthStr <= maxMonth
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-8 text-sm",
            !startMonth && "text-muted-foreground"
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4">
          {/* Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDisplayYear(displayYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold">{displayYear}</div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDisplayYear(displayYear + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2">
            {months.map((month, idx) => {
              const isSelected = isMonthSelected(displayYear, idx)
              const isInRange = isMonthInRange(displayYear, idx)
              const isHovered = isMonthHovered(displayYear, idx)

              return (
                <button
                  key={month}
                  onClick={() => handleMonthClick(displayYear, idx)}
                  onMouseEnter={() => setHoveredMonth(`${displayYear}-${String(idx + 1).padStart(2, '0')}`)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className={cn(
                    "py-2 px-3 text-sm rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-primary text-primary-foreground font-semibold hover:bg-primary hover:text-primary-foreground",
                    (isInRange || isHovered) && !isSelected && "bg-primary/20 text-primary font-medium"
                  )}
                >
                  {month}
                </button>
              )
            })}
          </div>

          {/* Helper Text */}
          <div className="mt-4 text-xs text-muted-foreground text-center">
            {selectingStart ? "Select start month" : "Select end month"}
          </div>

          {/* Clear Button */}
          {startMonth && endMonth && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                onRangeChange("", "")
                setSelectingStart(true)
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
