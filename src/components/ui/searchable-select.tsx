"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SearchableSelectProps {
  options: Array<{ value: string; label: string }>
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  searchPlaceholder?: string
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  className,
  searchPlaceholder = "Search...",
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [triggerWidth, setTriggerWidth] = React.useState<number>(0)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth)
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-12", className)}
        >
          {value
            ? options.find((option) => option.value === value)?.label
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: triggerWidth }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-12" />
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-y-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => {
                  onValueChange?.(option.value === value ? "" : option.value)
                  setOpen(false)
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}