"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
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
    if (!open) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement
      
      // If clicking inside our dropdown, don't close
      if (dropdownRef.current?.contains(target)) {
        return
      }
      
      // Close on any click outside - use setTimeout to ensure it happens after other handlers
      setTimeout(() => {
        setOpen(false)
      }, 0)
    }

    // Watch for Radix Select content appearing (when other Select dropdowns open)
    const checkForOtherDropdowns = () => {
      if (!open) return
      
      // Check if any Radix Select content is visible
      const selectContent = document.querySelector('[data-radix-select-content]')
      if (selectContent) {
        setOpen(false)
      }
    }

    const observer = new MutationObserver(checkForOtherDropdowns)
    observer.observe(document.body, { childList: true, subtree: true })

    // Check periodically for other dropdowns
    const intervalId = setInterval(checkForOtherDropdowns, 50)

    // Use capture phase to catch clicks early, before other handlers
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('click', handleClickOutside, true)
    document.addEventListener('touchstart', handleClickOutside, true)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('click', handleClickOutside, true)
      document.removeEventListener('touchstart', handleClickOutside, true)
      observer.disconnect()
      clearInterval(intervalId)
    }
  }, [open])

  const selectedOption = options.find(option => option.value === value)

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:bg-accent hover:text-accent-foreground",
          open && "ring-1 ring-ring"
        )}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
      >
        <span className="truncate flex-1 text-left line-clamp-1">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50", open && "rotate-180")} />
      </button>

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
                      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                    )}
                    onClick={() => {
                      onValueChange?.(option.value === value ? "" : option.value)
                      setOpen(false)
                      setSearchTerm("")
                    }}
                  >
                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check
                        className={cn(
                          "h-4 w-4 transition-opacity",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </span>
                    <span className="text-left flex-1">{option.label}</span>
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
