"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { POSITIONS } from "@/types"

// Dummy agents data for the dropdown
const dummyAgents = [
  { id: "1", name: "Steven Sharko" },
  { id: "2", name: "Ethan Neumann" },
  { id: "3", name: "Luca Baski" },
  { id: "4", name: "Wyatt Perichitch" },
  { id: "5", name: "Caiden Clayton" },
]

interface CreatePositionModalProps {
  trigger?: React.ReactNode
}

export default function CreatePositionModal({ trigger }: CreatePositionModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    userId: "",
    position: "",
    uplineId: "",
    startDate: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Creating position:", formData)
    // TODO: Implement position creation logic
    setIsOpen(false)
    setFormData({ userId: "", position: "", uplineId: "", startDate: "" })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="blue" size="sm">
            New Position +
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-800">
            Create Position
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* User */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              User
            </label>
            <Select
              value={formData.userId}
              onValueChange={(value) =>
                setFormData({ ...formData, userId: value })
              }
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select an Agent" />
              </SelectTrigger>
              <SelectContent>
                {dummyAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Position
            </label>
            <Select
              value={formData.position}
              onValueChange={(value) =>
                setFormData({ ...formData, position: value })
              }
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="---------" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {POSITIONS.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upline */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Upline
            </label>
            <Select
              value={formData.uplineId}
              onValueChange={(value) =>
                setFormData({ ...formData, uplineId: value })
              }
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select an Agent" />
              </SelectTrigger>
              <SelectContent>
                {dummyAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Start date
            </label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className="h-12"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            Submit
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}