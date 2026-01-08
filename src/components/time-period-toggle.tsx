"use client"

import { cn } from "@/lib/utils"
import { type TimePeriod } from "@/lib/date-utils"

interface TimePeriodToggleProps {
  value: TimePeriod
  onChange: (value: TimePeriod) => void
  className?: string
}

const OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'ytd', label: 'YTD' }
]

export function TimePeriodToggle({ value, onChange, className }: TimePeriodToggleProps) {
  const activeIndex = OPTIONS.findIndex(opt => opt.value === value)

  return (
    <div className={cn("relative bg-muted/50 p-1 rounded-lg", className)}>
      {/* Animated background slider */}
      <div
        className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out"
        style={{
          left: `calc(${activeIndex * 33.33}% + 4px)`,
          width: 'calc(33.33% - 8px)'
        }}
      />
      <div className="relative z-10 flex">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[90px] text-center",
              value === option.value
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
