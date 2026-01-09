"use client"

import * as React from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { queryKeys } from "@/hooks/queryKeys"

interface Option {
  value: string
  label: string
}

interface AsyncSearchableSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  searchPlaceholder?: string
  searchEndpoint: string // API endpoint for dynamic search
  defaultLabel?: string // Label to show for selected value before search
}

export function AsyncSearchableSelect({
  value,
  onValueChange,
  placeholder = "Select option...",
  className,
  searchPlaceholder = "Type to search...",
  searchEndpoint,
  defaultLabel,
}: AsyncSearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState("")
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(defaultLabel || null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Debounce search term
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch options using TanStack Query
  const { data: options = [], isLoading: loading } = useQuery<Option[]>({
    queryKey: queryKeys.searchAsync(searchEndpoint, debouncedSearchTerm),
    queryFn: async ({ signal }) => {
      const separator = searchEndpoint.includes('?') ? '&' : '?'
      const url = `${searchEndpoint}${separator}q=${encodeURIComponent(debouncedSearchTerm)}&limit=20`
      const response = await fetch(url, {
        signal,
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch options')
      }

      const data = await response.json()
      return data || []
    },
    enabled: open,
    staleTime: 30000,
  })

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

  const handleSelect = (option: Option) => {
    onValueChange?.(option.value === value ? "all" : option.value)
    setSelectedLabel(option.label)
    setOpen(false)
    setSearchTerm("")
  }

  const displayLabel = value && value !== 'all' && selectedLabel
    ? selectedLabel
    : placeholder

  return (
    <div className={cn("relative", open ? "z-50" : "z-auto", className)} ref={dropdownRef}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("w-full justify-between h-8 text-xs")}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-[51] w-full mt-1 bg-card border border-border rounded-md shadow-2xl backdrop-blur-sm">
          <div className="p-1.5">
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 text-xs bg-background text-foreground border-border"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : options.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                {searchTerm ? 'No results found.' : 'Type to search...'}
              </div>
            ) : (
              <>
                {/* Always show "All" option */}
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center px-2.5 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left",
                    (!value || value === 'all') && "bg-primary/20 text-primary"
                  )}
                  onClick={() => {
                    onValueChange?.("all")
                    setSelectedLabel(null)
                    setOpen(false)
                    setSearchTerm("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      (!value || value === 'all') ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <span className="text-left flex-1">{placeholder}</span>
                </button>
                {options.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={cn(
                      "w-full flex items-center px-2.5 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left",
                      value === option.value && "bg-primary/20 text-primary"
                    )}
                    onClick={() => handleSelect(option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <span className="text-left flex-1 truncate">{option.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

