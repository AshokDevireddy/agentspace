"use client"

import * as React from "react"
import { createPortal } from "react-dom"
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
  disabled?: boolean
  portal?: boolean // Use portal to escape overflow:hidden containers
}

export function SimpleSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  className,
  searchPlaceholder = "Search...",
  disabled = false,
  portal = false,
}: SimpleSearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [showDropdown, setShowDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 })

  // Filter options based on search term - use useMemo instead of useEffect to avoid infinite loops
  const filteredOptions = React.useMemo(() => {
    if (!options || !Array.isArray(options)) {
      return []
    }

    return options.filter(option => {
      if (!option || typeof option.label !== 'string') {
        return false
      }
      return option.label.toLowerCase().includes(searchTerm.toLowerCase())
    })
  }, [searchTerm, options])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open || !showDropdown) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // If clicking inside our dropdown or button, don't close
      if (dropdownRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return
      }

      // Close dropdown
      setShowDropdown(false)
      setOpen(false)
    }

    // Use capture phase to catch clicks early
    document.addEventListener('mousedown', handleClickOutside, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [open, showDropdown])

  // Show dropdown when opened and has filtered options
  React.useEffect(() => {
    if (open && filteredOptions.length > 0) {
      setShowDropdown(true)
    } else if (!open) {
      setShowDropdown(false)
    }
  }, [open, filteredOptions])

  // Reset search term when dropdown closes
  React.useEffect(() => {
    if (!open) {
      setSearchTerm("")
      setShowDropdown(false)
    }
  }, [open])

  console.log('[SimpleSearchableSelect] About to call options.find()')
  console.log('[SimpleSearchableSelect] options:', options)
  console.log('[SimpleSearchableSelect] options type:', typeof options)
  console.log('[SimpleSearchableSelect] options is array?', Array.isArray(options))
  console.log('[SimpleSearchableSelect] value:', value)
  
  const selectedOption = options.find(option => option.value === value)

  // Update dropdown position when portal mode and open
  React.useEffect(() => {
    if (portal && open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [portal, open])

  // Dropdown content
  const dropdownContent = showDropdown && open && (
    <div
      className={cn(
        "bg-card border border-border rounded-md shadow-2xl backdrop-blur-sm",
        portal ? "fixed z-[99999]" : "absolute top-full left-0 z-[9999] w-full mt-1"
      )}
      style={portal ? {
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        minWidth: 200
      } : undefined}
    >
      <div className="p-1.5">
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowDropdown(true)}
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
                onMouseDown={(e) => {
                  e.preventDefault()
                  setShowDropdown(false)
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
  )

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:bg-accent hover:text-accent-foreground",
          open && "ring-1 ring-ring"
        )}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setOpen(!open)
        }}
      >
        <span className="truncate flex-1 text-left line-clamp-1">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50", open && "rotate-180")} />
      </button>

      {portal && typeof document !== 'undefined'
        ? createPortal(dropdownContent, document.body)
        : dropdownContent
      }
    </div>
  )
}
