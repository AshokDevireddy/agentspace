"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Users, Clock } from "lucide-react"
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useState, useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"

interface PersistencyData {
  activeDealCount: number
  inactiveDealCount: number
  totalDealCount: number
  persistencyRate: number
}

interface PersistencyResponse {
  personal: PersistencyData
  downline: PersistencyData
}

const TIMEFRAME_OPTIONS = [
  { value: '3months', label: '3 Months' },
  { value: '6months', label: '6 Months' },
  { value: '9months', label: '9 Months' },
  { value: 'alltime', label: 'All Time' }
]

const COLORS = {
  active: 'hsl(var(--primary))',
  inactive: 'hsl(var(--muted))'
}

export default function PersistencyCard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'personal' | 'downline'>('personal')
  const [timeframe, setTimeframe] = useState('3months')
  const [data, setData] = useState<PersistencyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchPersistencyData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/persistency?user_id=${user.id}&timeframe=${timeframe}`)

        if (!response.ok) {
          throw new Error('Failed to fetch persistency data')
        }

        const result = await response.json()

        console.log('=== PERSISTENCY COMPONENT RESPONSE ===')
        console.log('Success:', result.success)
        console.log('Data:', result.data)
        console.log('Error:', result.error)

        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to fetch persistency data')
        }
      } catch (err) {
        console.error('Error fetching persistency data:', err)
        setError('Failed to fetch persistency data')
      } finally {
        setLoading(false)
      }
    }

    fetchPersistencyData()
  }, [user, timeframe])

  if (!user || loading) {
    return (
      <Card className="professional-card">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Persistency Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="professional-card">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Persistency Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-red-500">{error}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentData = data ? data[activeTab] : null
  console.log('=== PERSISTENCY COMPONENT RENDER ===')
  console.log('Active tab:', activeTab)
  console.log('Current data:', currentData)
  console.log('All data:', data)

  const chartData = currentData ? [
    { name: 'Active', value: currentData.activeDealCount, color: COLORS.active },
    { name: 'Inactive', value: currentData.inactiveDealCount, color: COLORS.inactive }
  ] : []

  console.log('Chart data:', chartData)

  return (
    <Card className="professional-card">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Persistency Metrics</span>
          </CardTitle>

          {/* Timeframe Toggle */}
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-1">
              {TIMEFRAME_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={timeframe === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tab Toggle */}
          <div className="flex space-x-1 bg-muted rounded-lg p-1">
            <Button
              variant={activeTab === 'personal' ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab('personal')}
              className="flex-1 text-sm"
            >
              <Users className="h-4 w-4 mr-1" />
              Your Persistency
            </Button>
            <Button
              variant={activeTab === 'downline' ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab('downline')}
              className="flex-1 text-sm"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Downline Persistency
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {currentData && currentData.totalDealCount > 0 ? (
          <div className="space-y-6">
            {/* Pie Chart */}
            <div className="h-48 w-48 mx-auto relative">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, `${name} Deals`]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentData.persistencyRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Persistency
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-500">
                  {currentData.activeDealCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Active Deals
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-500">
                  {currentData.inactiveDealCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Inactive Deals
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {currentData.totalDealCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Deals
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-muted rounded-full"></div>
                <span className="text-sm text-muted-foreground">Inactive</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-lg text-muted-foreground mb-2">No data available</div>
              <div className="text-sm text-muted-foreground">
                {activeTab === 'personal'
                  ? 'No deals found for the selected timeframe'
                  : 'No downline deals found for the selected timeframe'
                }
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
