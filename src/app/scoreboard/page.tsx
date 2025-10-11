"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Award, ChevronRight } from "lucide-react"

// Dummy data for scoreboard
const weeklyStats = {
  production: "$511.3K",
  familiesProtected: "522",
  activeAgents: "171"
}

const topAgents = [
  {
    rank: 1,
    name: "Steven Sharko",
    amount: "$17,101.08",
    avatar: "🥇",
    icon: Trophy,
    color: "text-yellow-500"
  },
  {
    rank: 2,
    name: "Ethan Neumann",
    amount: "$13,754.40",
    avatar: "🥈",
    icon: Medal,
    color: "text-gray-400"
  },
  {
    rank: 3,
    name: "Luca Baski",
    amount: "$12,685.92",
    avatar: "🥉",
    icon: Award,
    color: "text-orange-500"
  }
]

const leaderboardData = [
  { rank: 1, name: "Steven Sharko", may19: "$1,496.28", may20: "$7,478.16", may21: "$2,596.68", may22: "--", may23: "$5,529.96", may24: "--", may25: "--", total: "$17,101.08" },
  { rank: 2, name: "Ethan Neumann", may19: "$3,611.28", may20: "$834.12", may21: "$2,525.40", may22: "$881.52", may23: "$5,902.08", may24: "--", may25: "--", total: "$13,754.40" },
  { rank: 3, name: "Luca Baski", may19: "$1,318.80", may20: "$2,622.24", may21: "$3,431.88", may22: "$4,402.68", may23: "$910.32", may24: "--", may25: "--", total: "$12,685.92" },
  { rank: 4, name: "Wyatt Perichitch", may19: "$1,850.16", may20: "$2,238.72", may21: "$2,971.20", may22: "--", may23: "$5,087.04", may24: "--", may25: "--", total: "$12,147.12" },
  { rank: 5, name: "Caiden Clayton", may19: "$1,571.28", may20: "$4,333.92", may21: "$1,599.48", may22: "$3,128.40", may23: "$893.76", may24: "--", may25: "--", total: "$11,526.84" },
  { rank: 6, name: "Danny Hauser", may19: "$2,848.08", may20: "--", may21: "--", may22: "$3,656.52", may23: "$3,887.04", may24: "--", may25: "--", total: "$10,391.64" },
  { rank: 7, name: "Jackson Meyer", may19: "$3,174.72", may20: "$2,449.56", may21: "$2,775.36", may22: "$1,160.28", may23: "$828.00", may24: "--", may25: "--", total: "$10,387.92" },
  { rank: 8, name: "Mason Laughlin", may19: "$2,641.80", may20: "$1,249.56", may21: "$1,556.40", may22: "$1,295.64", may23: "$3,352.92", may24: "--", may25: "--", total: "$10,096.32" },
  { rank: 9, name: "Cameron McNeal", may19: "$2,413.68", may20: "--", may21: "$1,753.44", may22: "$3,788.40", may23: "$1,767.72", may24: "--", may25: "--", total: "$9,723.24" },
  { rank: 10, name: "Christopher Jentz", may19: "$485.76", may20: "--", may21: "$5,694.24", may22: "$3,517.44", may23: "--", may24: "--", may25: "--", total: "$9,697.44" },
  { rank: 11, name: "Tanner Littrell", may19: "$2,153.04", may20: "--", may21: "$4,950.12", may22: "$656.88", may23: "$1,185.96", may24: "--", may25: "--", total: "$8,946.00" },
  { rank: 12, name: "Barrett Brazell", may19: "$1,200.36", may20: "$4,807.56", may21: "--", may22: "--", may23: "$1,976.04", may24: "--", may25: "--", total: "$7,983.96" },
  { rank: 13, name: "Noah Bahu", may19: "$3,422.04", may20: "$2,931.00", may21: "--", may22: "$1,438.56", may23: "--", may24: "--", may25: "--", total: "$7,791.60" },
]

export default function Scoreboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient mb-2">Scoreboard</h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>This Week</span>
            <span>•</span>
            <span>May 19, 2025 - May 25, 2025</span>
          </div>
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Production</h3>
            <p className="text-3xl font-bold text-primary">{weeklyStats.production}</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Families Protected</h3>
            <p className="text-3xl font-bold text-green-400">{weeklyStats.familiesProtected}</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Agents</h3>
            <p className="text-3xl font-bold text-blue-400">{weeklyStats.activeAgents}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Winners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {topAgents.map((agent, index) => (
          <Card key={agent.rank} className="professional-card relative overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <span className="text-4xl">{agent.avatar}</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{agent.name}</h3>
              <p className="text-2xl font-bold text-green-400">{agent.amount}</p>
              <Badge
                variant="outline"
                className={`mt-2 ${
                  index === 0 ? 'border-yellow-500 text-yellow-500' :
                  index === 1 ? 'border-gray-400 text-gray-400' :
                  'border-orange-500 text-orange-500'
                }`}
              >
                #{agent.rank}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leaderboard Table */}
      <Card className="professional-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">Production Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rank</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">5/19</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">5/20</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">5/21</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">5/22</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">5/23</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">5/24</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">5/25</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((agent, index) => (
                  <tr key={agent.rank} className={`border-b border-border hover:bg-accent/50 transition-colors ${index < 3 ? 'bg-primary/10' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">{agent.rank}</span>
                        {index < 3 && (
                          <span className={`text-lg ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-500'}`}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">{agent.name}</td>
                    <td className="py-3 px-4 text-center text-foreground">{agent.may19}</td>
                    <td className="py-3 px-4 text-center text-foreground">{agent.may20}</td>
                    <td className="py-3 px-4 text-center text-foreground">{agent.may21}</td>
                    <td className="py-3 px-4 text-center text-foreground">{agent.may22}</td>
                    <td className="py-3 px-4 text-center text-foreground">{agent.may23}</td>
                    <td className="py-3 px-4 text-center text-foreground">{agent.may24}</td>
                    <td className="py-3 px-4 text-center text-foreground">{agent.may25}</td>
                    <td className="py-3 px-4 text-right font-bold text-green-400">{agent.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}