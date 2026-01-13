"use client"

import { cn } from "@/lib/utils"

export type ProductionMode = 'submitted' | 'issue_paid'

interface ProductionModeToggleProps {
  value: ProductionMode
  onChange: (value: ProductionMode) => void
  className?: string
}

const OPTIONS: { value: ProductionMode; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'issue_paid', label: 'Issue Paid' }
]

export function ProductionModeToggle({ value, onChange, className }: ProductionModeToggleProps) {
  const activeIndex = OPTIONS.findIndex(opt => opt.value === value)

  return (
    <div className={cn("relative bg-muted/50 p-1 rounded-lg", className)}>
      {/* Animated background slider */}
      <div
        className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out"
        style={{
          left: `calc(${activeIndex * 50}% + 4px)`,
          width: 'calc(50% - 8px)'
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
