"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Clock,
  UserCircle,
  MoreVertical,
  Play,
  Pause,
  Volume2,
  Calendar,
  Filter
} from "lucide-react"

interface CallRecord {
  id: string
  contactName: string
  contactPhone: string
  type: 'incoming' | 'outgoing' | 'missed'
  duration?: string
  timestamp: string
  date: string
  status: 'completed' | 'missed' | 'busy' | 'no-answer'
  hasRecording?: boolean
  notes?: string
}

const mockCallRecords: CallRecord[] = [
  {
    id: "1",
    contactName: "John Anderson",
    contactPhone: "(555) 123-4567",
    type: "outgoing",
    duration: "12:34",
    timestamp: "2:30 PM",
    date: "Today",
    status: "completed",
    hasRecording: true,
    notes: "Discussed life insurance policy details"
  },
  {
    id: "2",
    contactName: "Sarah Williams",
    contactPhone: "(555) 234-5678",
    type: "incoming",
    duration: "8:15",
    timestamp: "1:15 PM",
    date: "Today",
    status: "completed",
    hasRecording: true
  },
  {
    id: "3",
    contactName: "Michael Chen",
    contactPhone: "(555) 345-6789",
    type: "missed",
    timestamp: "11:45 AM",
    date: "Today",
    status: "missed",
    hasRecording: false
  },
  {
    id: "4",
    contactName: "Emily Rodriguez",
    contactPhone: "(555) 456-7890",
    type: "outgoing",
    duration: "15:22",
    timestamp: "10:20 AM",
    date: "Today",
    status: "completed",
    hasRecording: true,
    notes: "Follow-up on claim status"
  },
  {
    id: "5",
    contactName: "David Thompson",
    contactPhone: "(555) 567-8901",
    type: "incoming",
    duration: "6:43",
    timestamp: "4:30 PM",
    date: "Yesterday",
    status: "completed",
    hasRecording: false
  }
]

export default function CallCenterPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<string>("all")
  const [playingRecording, setPlayingRecording] = useState<string | null>(null)

  const filteredCalls = mockCallRecords.filter(call => {
    const matchesSearch = call.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         call.contactPhone.includes(searchQuery)

    const matchesFilter = selectedFilter === "all" ||
                         (selectedFilter === "missed" && call.status === "missed") ||
                         (selectedFilter === "incoming" && call.type === "incoming") ||
                         (selectedFilter === "outgoing" && call.type === "outgoing")

    return matchesSearch && matchesFilter
  })

  const getCallIcon = (type: string, status: string) => {
    if (status === "missed") return PhoneMissed
    if (type === "incoming") return PhoneIncoming
    if (type === "outgoing") return PhoneOutgoing
    return Phone
  }

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-500"
      case "missed": return "text-red-500"
      case "busy": return "text-orange-500"
      case "no-answer": return "text-yellow-500"
      default: return "text-muted-foreground"
    }
  }

  const initiateCall = (phone: string, name: string) => {
    alert(`Initiating call to ${name} at ${phone}`)
  }

  const toggleRecording = (callId: string) => {
    if (playingRecording === callId) {
      setPlayingRecording(null)
    } else {
      setPlayingRecording(callId)
    }
  }

  const totalCalls = mockCallRecords.length
  const completedCalls = mockCallRecords.filter(call => call.status === "completed").length
  const missedCalls = mockCallRecords.filter(call => call.status === "missed").length
  const totalDuration = mockCallRecords
    .filter(call => call.duration)
    .reduce((total, call) => {
      if (!call.duration) return total
      const [minutes, seconds] = call.duration.split(":").map(Number)
      return total + minutes * 60 + seconds
    }, 0)

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Call Center</h1>
          <p className="text-muted-foreground mt-1">Manage your client communications</p>
        </div>
        <Button className="btn-gradient">
          <PhoneCall className="h-4 w-4 mr-2" />
          Make Call
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Calls</p>
              <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <PhoneCall className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-foreground">{completedCalls}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <PhoneMissed className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Missed</p>
              <p className="text-2xl font-bold text-foreground">{missedCalls}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Duration</p>
              <p className="text-2xl font-bold text-foreground">{formatTotalDuration(totalDuration)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="professional-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-2">
              {[
                { id: "all", label: "All Calls" },
                { id: "incoming", label: "Incoming" },
                { id: "outgoing", label: "Outgoing" },
                { id: "missed", label: "Missed" }
              ].map((filter) => (
                <Button
                  key={filter.id}
                  variant={selectedFilter === filter.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFilter(filter.id)}
                  className={selectedFilter === filter.id ? "btn-gradient" : ""}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Call Records */}
      <Card className="professional-card">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Recent Calls</h2>
        </div>

        <div className="divide-y divide-border">
          {filteredCalls.map((call) => {
            const CallIcon = getCallIcon(call.type, call.status)

            return (
              <div key={call.id} className="p-6 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "p-2 rounded-full",
                      call.status === "missed" ? "bg-red-500/20" :
                      call.type === "incoming" ? "bg-green-500/20" :
                      "bg-blue-500/20"
                    )}>
                      <CallIcon className={cn(
                        "h-5 w-5",
                        getCallStatusColor(call.status)
                      )} />
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{call.contactName}</h3>
                        <p className="text-sm text-muted-foreground">{call.contactPhone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <Badge variant={call.status === "completed" ? "default" : "destructive"}>
                          {call.status}
                        </Badge>
                        {call.duration && (
                          <span className="text-sm text-muted-foreground">{call.duration}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {call.date} at {call.timestamp}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {call.hasRecording && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleRecording(call.id)}
                          className="text-primary hover:text-primary"
                        >
                          {playingRecording === call.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => initiateCall(call.contactPhone, call.contactName)}
                        className="text-green-500 hover:text-green-600"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>

                      <Button size="sm" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {call.notes && (
                  <div className="mt-3 ml-20">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">{call.notes}</p>
                    </div>
                  </div>
                )}

                {playingRecording === call.id && call.hasRecording && (
                  <div className="mt-4 ml-20">
                    <div className="flex items-center space-x-3 p-3 bg-primary/10 rounded-lg">
                      <Volume2 className="h-4 w-4 text-primary" />
                      <div className="flex-1 bg-primary/20 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full w-1/3"></div>
                      </div>
                      <span className="text-sm text-muted-foreground">2:34 / {call.duration}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}