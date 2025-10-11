"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'

// Reference existing agent data
const agents = [
  { name: "Friday, Clayton", position: "Karma Director 2" },
  { name: "Yousif, Darius", position: "Legacy MGA" },
  { name: "Phillips, Adam", position: "Legacy GA" },
  { name: "Perichitch, Wyatt", position: "Legacy GA" },
  { name: "Schwartz, Joseph", position: "Legacy Junior Partner" },
]

const agentsData = [
    {
      id: "1",
      name: "Schwartz, Joseph",
      position: "Legacy Junior Partner",
      upline: "Toma, Gianni",
      created: "Dec. 3, 2024, 6:09 p.m.",
      lastLogin: "May 21, 2025, 9:45 a.m.",
      earnings: "$2,162.28 / $4,513,176.94",
      downlines: 25,
      status: "Active",
      badge: "Legacy Junior Partner"
    },
    {
      id: "2",
      name: "Friday, Clayton",
      position: "Karma Director 2",
      upline: "Schwartz, Joseph",
      created: "April 8, 2025, 5:10 p.m.",
      lastLogin: "May 12, 2025, 11:25 a.m.",
      earnings: "$0.00 / $425.87",
      downlines: 6,
      status: "Active",
      badge: "Karma Director 2"
    },
    {
      id: "3",
      name: "Robinson, D Shaun",
      position: "Karma Director 1",
      upline: "Friday, Clayton",
      created: "May 7, 2025, 4:39 p.m.",
      lastLogin: "May 19, 2025, 10:29 a.m.",
      earnings: "$0.00 / $586.15",
      downlines: 1,
      status: "Active",
      badge: "Karma Director 1"
    },
    {
      id: "4",
      name: "Yousif, Darius",
      position: "Legacy MGA",
      upline: "Schwartz, Joseph",
      created: "Dec. 3, 2024, 6:09 p.m.",
      lastLogin: "May 16, 2025, 9:46 a.m.",
      earnings: "$52,772.76 / $81,446.36",
      downlines: 8,
      status: "Active",
      badge: "Legacy MGA"
    },
    {
      id: "5",
      name: "Agency, Wyatt & Sontag",
      position: "Legacy GA",
      upline: "Schwartz, Joseph",
      created: "Jan. 22, 2025, 7:40 a.m.",
      lastLogin: "Jan. 22, 2025, 3:02 p.m.",
      earnings: "$0.00 / $0.00",
      downlines: 0,
      status: "Active",
      badge: "Legacy GA"
    },
    {
      id: "6",
      name: "Perichitch, Milutin",
      position: "Legacy GA",
      upline: "Schwartz, Joseph",
      created: "Dec. 3, 2024, 6:09 p.m.",
      lastLogin: "May 21, 2025, 9:06 p.m.",
      earnings: "$62,076.84 / $306,058.89",
      downlines: 45,
      status: "Active",
      badge: "Legacy GA"
    },
    {
      id: "7",
      name: "Perichitch, Wyatt",
      position: "Legacy GA",
      upline: "Schwartz, Joseph",
      created: "April 12, 2025, 10:15 a.m.",
      lastLogin: "May 10, 2025, 3:29 p.m.",
      earnings: "$38,939.04 / $38,890.65",
      downlines: 0,
      status: "Active",
      badge: "Legacy GA"
    },
    {
      id: "8",
      name: "Phillips, Adam",
      position: "Legacy GA",
      upline: "Schwartz, Joseph",
      created: "Dec. 3, 2024, 6:09 p.m.",
      lastLogin: "May 23, 2025, 6:30 p.m.",
      earnings: "$118,729.56 / $358,791.54",
      downlines: 50,
      status: "Active",
      badge: "Legacy GA"
    },
    {
      id: "9",
      name: "Zaks, Sontag",
      position: "Legacy GA",
      upline: "Schwartz, Joseph",
      created: "Dec. 3, 2024, 6:09 p.m.",
      lastLogin: "May 21, 2025, 7:02 a.m.",
      earnings: "$0.00 / $147,805.56",
      downlines: 60,
      status: "Active",
      badge: "Legacy GA"
    },
    {
      id: "10",
      name: "Diamond Financial Group",
      position: "Legacy SA",
      upline: "Saguy, Jonah",
      created: "Feb. 21, 2025, 10:46 a.m.",
      lastLogin: "May 18, 2025, 10:23 a.m.",
      earnings: "$0.00 / $0.00",
      downlines: 0,
      status: "Active",
      badge: "Legacy SA"
    }
]

// Sample production data for each day
const emptyProductionData = [
  { date: '5-26', production: 0 },
  { date: '5-27', production: 0 },
  { date: '5-28', production: 0 },
  { date: '5-29', production: 0 },
  { date: '5-30', production: 0 },
  { date: '5-31', production: 0 },
  { date: '6-01', production: 0 },
]

export default function TeamsAnalytics() {
  const [selectedAgent, setSelectedAgent] = useState<string>("")

  const agentOptions = agents.map(agent => ({
    value: agent.name,
    label: agent.name
  }))

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
            <div className="mt-2 text-sm text-gray-600">
              May 26, 2025 - Jun 1, 2025
            </div>
          </div>
          <div className="w-64">
            <SimpleSearchableSelect
              options={agentOptions}
              value={selectedAgent}
              onValueChange={setSelectedAgent}
              placeholder="Select an Agent"
              searchPlaceholder="Search agents..."
            />
          </div>
        </div>
      </div>

      {/* Agent Teams Data */}
      {agents.map((agent) => (
        <div key={agent.name} className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{agent.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agents Chart */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Agents</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={emptyProductionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        domain={[-1, 1]}
                        ticks={[-1, -0.5, 0, 0.5, 1]}
                      />
                      <Line
                        type="monotone"
                        dataKey="production"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Production Chart */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Production</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={emptyProductionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        domain={[-1, 1]}
                        ticks={[-1, -0.5, 0, 0.5, 1]}
                      />
                      <Line
                        type="monotone"
                        dataKey="production"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}
    </div>
  )
}