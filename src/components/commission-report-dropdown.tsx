"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronDown } from "lucide-react"
import ImportCommissionModal from "./modals/import-commission-modal"

// Carrier options
const carrierOptions = [
  { id: "aetna", name: "Aetna" },
  { id: "aflac", name: "Aflac" },
  { id: "ahl", name: "AHL" },
  { id: "american-amicable", name: "American Amicable" },
  { id: "baltimore-life", name: "Baltimore Life" },
  { id: "foresters", name: "Foresters" },
  { id: "gtl", name: "Guarantee Trust Life" },
  { id: "liberty-bankers", name: "Liberty Bankers Life" },
  { id: "occidental", name: "Occidental" },
  { id: "rna", name: "Royal Neighbors" },
]

export default function CommissionReportDropdown() {
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const handleCarrierSelect = (carrierId: string) => {
    setSelectedCarrier(carrierId)
    setIsPopoverOpen(false)
  }

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="blue" size="sm" className="flex items-center gap-2">
            Add Commission Report +
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <div className="space-y-1">
            {carrierOptions.map((carrier) => (
              <button
                key={carrier.id}
                onClick={() => handleCarrierSelect(carrier.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md cursor-pointer"
              >
                {carrier.name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {selectedCarrier && (
        <ImportCommissionModal
          selectedCarrier={selectedCarrier}
          trigger={<div style={{ display: 'none' }} />}
        />
      )}
    </>
  )
}