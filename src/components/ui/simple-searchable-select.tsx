"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SimpleSearchableSelectProps {
  options: Array<{ value: string; label: string }>
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  searchPlaceholder?: string
}

export function SimpleSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  className,
  searchPlaceholder = "Search...",
}: SimpleSearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [filteredOptions, setFilteredOptions] = React.useState(options)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Filter options based on search term
  React.useEffect(() => {
    if (!options || !Array.isArray(options)) {
      setFilteredOptions([])
      return
    }

    const filtered = options.filter(option => {
      if (!option || typeof option.label !== 'string') {
        return false
      }
      return option.label.toLowerCase().includes(searchTerm.toLowerCase())
    })
    setFilteredOptions(filtered)
  }, [searchTerm, options])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const selectedOption = options.find(option => option.value === value)

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full justify-between h-10 text-sm border-border bg-card text-foreground hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-0",
          open && "ring-2 ring-primary/60"
        )}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate flex-1 text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] w-full mt-1 bg-card border border-border rounded-md shadow-2xl backdrop-blur-sm">
          <div className="p-1.5">
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm bg-background text-foreground border-border"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No option found.
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value === option.value
                return (
                  <button
                    type="button"
                    key={option.value}
                    className={cn(
                      "w-full flex items-center px-3 py-2 text-sm cursor-pointer transition-colors text-left",
                      isSelected
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => {
                      onValueChange?.(option.value === value ? "" : option.value)
                      setOpen(false)
                      setSearchTerm("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0 transition-opacity",
                        isSelected ? "opacity-100 text-primary-foreground" : "opacity-0"
                      )}
                    />
                    <span className={cn(
                      "text-left flex-1",
                      isSelected && "text-primary-foreground"
                    )}>{option.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
