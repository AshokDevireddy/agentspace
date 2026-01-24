"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface LeadSourceInputProps {
  options: Array<{ value: string; label: string }>
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function LeadSourceInput({
  options,
  value,
  onValueChange,
  placeholder = "Type or select lead source...",
  className,
  disabled = false,
}: LeadSourceInputProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Update input value when value prop changes
  React.useEffect(() => {
    setInputValue(value || "")
  }, [value])

  // Filter options based on input value
  const filteredOptions = React.useMemo(() => {
    if (!options || !Array.isArray(options)) {
      return []
    }

    if (!inputValue.trim()) {
      return options
    }

    return options.filter(option => {
      if (!option || typeof option.label !== 'string') {
        return false
      }
      return option.label.toLowerCase().includes(inputValue.toLowerCase())
    })
  }, [inputValue, options])

  // Check if current input value matches an existing option
  const exactMatch = options.find(option => 
    option.label.toLowerCase() === inputValue.toLowerCase()
  )

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement
      
      if (dropdownRef.current?.contains(target) || inputRef.current?.contains(target)) {
        return
      }
      
      setTimeout(() => {
        setOpen(false)
      }, 0)
    }

    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('click', handleClickOutside, true)
    document.addEventListener('touchstart', handleClickOutside, true)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('click', handleClickOutside, true)
      document.removeEventListener('touchstart', handleClickOutside, true)
    }
  }, [open])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onValueChange?.(newValue)
    setOpen(true)
  }

  const handleInputFocus = () => {
    setOpen(true)
  }

  const handleSelectOption = (optionValue: string, optionLabel: string) => {
    setInputValue(optionLabel)
    onValueChange?.(optionValue)
    setOpen(false)
  }

  const handleInputBlur = () => {
    // Delay closing to allow option click to register
    setTimeout(() => {
      setOpen(false)
    }, 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Enter' && filteredOptions.length > 0 && !exactMatch) {
      // If Enter is pressed and there's a filtered option, select the first one
      e.preventDefault()
      const firstOption = filteredOptions[0]
      handleSelectOption(firstOption.value, firstOption.label)
    }
  }

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="h-12 pr-10"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="absolute right-0 top-0 h-12 px-3 flex items-center justify-center"
        >
          <ChevronDown className={cn("h-4 w-4 opacity-50", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 z-[9999] w-full mt-1 bg-card border border-border rounded-md shadow-2xl backdrop-blur-sm">
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length === 0 && inputValue.trim() ? (
              <div className="py-3 px-4 text-xs text-muted-foreground">
                <div className="mb-2">No matching lead source found.</div>
                <div className="text-foreground font-medium">
                  "{inputValue}" will be added as a new lead source.
                </div>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No lead sources available. Start typing to create a new one.
              </div>
            ) : (
              <>
                {filteredOptions.map((option) => {
                  const isSelected = value === option.value
                  return (
                    <button
                      type="button"
                      key={option.value}
                      className={cn(
                        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                      )}
                      onClick={() => handleSelectOption(option.value, option.label)}
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
                })}
                {inputValue.trim() && !exactMatch && (
                  <div className="border-t border-border pt-1 pb-1">
                    <button
                      type="button"
                      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                      onClick={() => {
                        setInputValue(inputValue.trim())
                        onValueChange?.(inputValue.trim())
                        setOpen(false)
                      }}
                    >
                      <span className="text-left flex-1">
                        <span className="font-medium">Create "{inputValue.trim()}"</span>
                        <span className="text-xs text-muted-foreground ml-2">(new lead source)</span>
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

