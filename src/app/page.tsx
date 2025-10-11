"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import CreatePositionModal from "@/components/modals/create-position-modal"
import ImportCommissionModal from "@/components/modals/import-commission-modal"
import PersistencyCard from "@/components/persistency-card"
import {
  DollarSign,
  Users,
  Target,
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  ChevronRight
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts'
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"

// Dummy data
const productionData = [
  { month: '5-19', production: 45000, commissions: 9000 },
  { month: '5-20', production: 48000, commissions: 9600 },
  { month: '5-21', production: 47000, commissions: 9400 },
  { month: '5-22', production: 43000, commissions: 8600 },
  { month: '5-23', production: 35000, commissions: 7000 },
  { month: '5-24', production: 5000, commissions: 1000 },
  { month: '5-25', production: 1000, commissions: 200 },
]

const goalData = [
  { name: 'Achieved', value: 4509580.78, color: '#8b5cf6' },
  { name: 'Remaining', value: 5490419.22, color: '#e5e7eb' },
]

const topProducers = [
  { rank: 1, name: 'Sharko, Steven', amount: '$17,101.08', color: 'text-yellow-500' },
  { rank: 2, name: 'Neumann, Ethan', amount: '$13,754.40', color: 'text-gray-400' },
  { rank: 3, name: 'Perichitch, Wyatt', amount: '$13,031.76', color: 'text-orange-500' },
  { rank: 4, name: 'Baski, Luca', amount: '$12,685.92', color: 'text-gray-600' },
  { rank: 5, name: 'Clayton, Caiden', amount: '$11,526.84', color: 'text-gray-600' },
]

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string>('')
  const [userDataLoading, setUserDataLoading] = useState(true)
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Fetch user data from API
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setUserDataLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/user/profile?user_id=${user.id}`)

        if (!response.ok) {
          throw new Error('Failed to fetch profile data')
        }

        const result = await response.json()

        if (result.success) {
          setFirstName(result.data.firstName || 'User')
        } else {
          console.error('API Error:', result.error)
          // Fallback to auth metadata
          const authFirstName = user.user_metadata?.first_name || 'User'
          setFirstName(authFirstName)
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        // Fallback to auth metadata
        const authFirstName = user.user_metadata?.first_name || 'User'
        setFirstName(authFirstName)
      } finally {
        setUserDataLoading(false)
      }
    }

    fetchUserData()
  }, [user])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const isOutside = Object.values(dropdownRefs.current).every(ref =>
        ref && !ref.contains(target)
      )
      if (isOutside) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleDropdownToggle = (itemName: string) => {
    setOpenDropdown(openDropdown === itemName ? null : itemName)
  }

  // Show loading screen until we have both auth and a valid firstName
  if (authLoading || userDataLoading || !firstName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient mb-2">
          Welcome back, {firstName}.
        </h1>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>This Week</span>
          <span>•</span>
          <span>May 19, 2025 - May 25, 2025</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Link href="/policies/post" className="block group">
          <Card className="professional-card p-6 text-center cursor-pointer group-hover:scale-105 transition-all duration-200">
            <div className="p-3 bg-primary/20 rounded-xl w-fit mx-auto mb-3">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Post a Deal</h3>
          </Card>
        </Link>

        <Link href="/agents" className="block group">
          <Card className="professional-card p-6 text-center cursor-pointer group-hover:scale-105 transition-all duration-200">
            <div className="p-3 bg-purple-500/20 rounded-xl w-fit mx-auto mb-3">
              <Users className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="font-semibold text-foreground">Agents</h3>
          </Card>
        </Link>

        <Link href="/communications/sms" className="block group">
          <Card className="professional-card p-6 text-center cursor-pointer group-hover:scale-105 transition-all duration-200">
            <div className="p-3 bg-green-500/20 rounded-xl w-fit mx-auto mb-3">
              <FileText className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="font-semibold text-foreground">Messages</h3>
          </Card>
        </Link>

        <Link href="/policies/book" className="block group">
          <Card className="professional-card p-6 text-center cursor-pointer group-hover:scale-105 transition-all duration-200">
            <div className="p-3 bg-orange-500/20 rounded-xl w-fit mx-auto mb-3">
              <FileText className="h-6 w-6 text-orange-400" />
            </div>
            <h3 className="font-semibold text-foreground">Book</h3>
          </Card>
        </Link>

        <Link href="/scoreboard" className="block group">
          <Card className="professional-card p-6 text-center cursor-pointer group-hover:scale-105 transition-all duration-200">
            <div className="p-3 bg-blue-500/20 rounded-xl w-fit mx-auto mb-3">
              <BarChart3 className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="font-semibold text-foreground">Scoreboard</h3>
          </Card>
        </Link>

        <div className="relative" ref={(el) => { dropdownRefs.current['Analytics'] = el }}>
          <button
            onClick={() => handleDropdownToggle('Analytics')}
            className="w-full group"
          >
            <Card className="professional-card p-6 text-center cursor-pointer group-hover:scale-105 transition-all duration-200">
              <div className="p-3 bg-indigo-500/20 rounded-xl w-fit mx-auto mb-3">
                <PieChart className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-foreground">Analytics</h3>
            </Card>
          </button>

          {/* Dropdown Menu */}
          {openDropdown === 'Analytics' && (
            <div className="absolute top-full left-0 mt-2 w-48 glass-effect rounded-xl shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-200">
              <div className="py-2">
                <Link
                  href="/analytics"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-4 py-3 text-sm text-foreground hover:text-primary hover:bg-accent/50 transition-colors rounded-lg mx-2"
                >
                  Overview
                </Link>
                <Link
                  href="/analytics/teams"
                  onClick={() => setOpenDropdown(null)}
                  className="block px-4 py-3 text-sm text-foreground hover:text-primary hover:bg-accent/50 transition-colors rounded-lg mx-2"
                >
                  Teams
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Annual Goal */}
        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Annual Goal</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-48 mx-auto relative">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={goalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    {goalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color === '#8b5cf6' ? 'hsl(var(--primary))' : 'hsl(var(--muted))'} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">45.1%</div>
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
              <div className="text-2xl font-bold text-primary">
                $4,509,580.78
              </div>
              <div className="text-sm text-muted-foreground">
                / $10,000,000.00
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Producers */}
        <Card className="professional-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Top Producers</span>
            </CardTitle>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">Week of May 19, 2025</div>
            <div className="space-y-4">
              {topProducers.map((producer) => (
                <div key={producer.rank} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      producer.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                      producer.rank === 2 ? 'bg-gray-400 text-gray-900' :
                      producer.rank === 3 ? 'bg-orange-500 text-orange-900' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {producer.rank}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {producer.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {producer.amount}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Persistency Metrics */}
        <PersistencyCard />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="professional-card p-6 text-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Production</h3>
          <p className="text-2xl font-bold text-foreground">$0.00</p>
          <div className="w-full bg-muted rounded-full h-2 mt-3">
            <div className="bg-primary h-2 rounded-full w-0"></div>
          </div>
        </Card>

        <Card className="professional-card p-6 text-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Gross Commission</h3>
          <p className="text-2xl font-bold text-primary">$132,824.61</p>
          <div className="w-full bg-muted rounded-full h-2 mt-3">
            <div className="bg-primary h-2 rounded-full w-3/4"></div>
          </div>
        </Card>

        <Card className="professional-card p-6 text-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Families Protected</h3>
          <p className="text-2xl font-bold text-green-400">442</p>
          <div className="w-full bg-muted rounded-full h-2 mt-3">
            <div className="bg-green-400 h-2 rounded-full w-5/6"></div>
          </div>
        </Card>

        <Card className="professional-card p-6 text-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Referrals Collected</h3>
          <p className="text-2xl font-bold text-foreground">0</p>
          <div className="w-full bg-muted rounded-full h-2 mt-3">
            <div className="bg-orange-400 h-2 rounded-full w-0"></div>
          </div>
        </Card>

        <Card className="professional-card p-6 text-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Referrals Sold</h3>
          <p className="text-2xl font-bold text-foreground">0</p>
          <div className="w-full bg-muted rounded-full h-2 mt-3">
            <div className="bg-purple-400 h-2 rounded-full w-0"></div>
          </div>
        </Card>
      </div>

      {/* Production & Commissions Chart */}
      <Card className="professional-card">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Production & Commissions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(value, name) => [
                    `$${value.toLocaleString()}`,
                    name === 'production' ? 'Production' : 'Commissions'
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="production"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  name="production"
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="commissions"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={3}
                  name="commissions"
                  dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center space-x-6 mt-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              <span className="text-sm text-muted-foreground">Production</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span className="text-sm text-muted-foreground">Commissions</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
