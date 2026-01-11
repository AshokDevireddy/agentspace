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

interface DateRangePickerProps {
  startDate: string // Format: "YYYY-MM-DD"
  endDate: string // Format: "YYYY-MM-DD"
  onRangeChange: (startDate: string, endDate: string) => void
  disabled?: boolean
}

export function DateRangePicker({ startDate, endDate, onRangeChange, disabled }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  // SSR-safe: useClientDate returns deterministic date on server, actual date on client
  const clientDate = useClientDate()
  const [displayMonth, setDisplayMonth] = useState(() => clientDate.date)
  const [selectingStart, setSelectingStart] = useState(true)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  // Sync displayMonth when clientDate becomes available (only on first render)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      setDisplayMonth(clientDate.date)
    }
  }, [clientDate.date])

  // Format display text
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ""
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const displayText = startDate && endDate
    ? `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`
    : "Select date range"

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const handleDateClick = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (selectingStart) {
      // First selection - set start date
      onRangeChange(dateStr, dateStr)
      setSelectingStart(false)
    } else {
      // Second selection - set end date
      const newStart = startDate
      const newEnd = dateStr

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

  const isDateSelected = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateStr === startDate || dateStr === endDate
  }

  const isDateInRange = (year: number, month: number, day: number) => {
    if (!startDate || !endDate) return false
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateStr >= startDate && dateStr <= endDate
  }

  const isDateHovered = (year: number, month: number, day: number) => {
    if (!hoveredDate || !startDate || selectingStart) return false
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const minDate = startDate < hoveredDate ? startDate : hoveredDate
    const maxDate = startDate > hoveredDate ? startDate : hoveredDate
    return dateStr >= minDate && dateStr <= maxDate
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(displayMonth)

  const prevMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-8 text-sm",
            !startDate && "text-muted-foreground"
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={prevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold">
              {monthNames[month]} {year}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1
              const isSelected = isDateSelected(year, month, day)
              const isInRange = isDateInRange(year, month, day)
              const isHovered = isDateHovered(year, month, day)

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(year, month, day)}
                  onMouseEnter={() => setHoveredDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
                  onMouseLeave={() => setHoveredDate(null)}
                  className={cn(
                    "h-8 w-8 text-sm rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-primary text-primary-foreground font-semibold hover:bg-primary hover:text-primary-foreground",
                    (isInRange || isHovered) && !isSelected && "bg-primary/20 text-primary font-medium"
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Helper Text */}
          <div className="mt-4 text-xs text-muted-foreground text-center">
            {selectingStart ? "Select start date" : "Select end date"}
          </div>

          {/* Clear Button */}
          {startDate && endDate && (
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
