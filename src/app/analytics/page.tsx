"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Download, Filter } from "lucide-react"

// Analytics data
const productionData = [
  { month: 'Jan', production: 45000, commissions: 9000, deals: 25 },
  { month: 'Feb', production: 52000, commissions: 10400, deals: 28 },
  { month: 'Mar', production: 48000, commissions: 9600, deals: 31 },
  { month: 'Apr', production: 61000, commissions: 12200, deals: 35 },
  { month: 'May', production: 58000, commissions: 11600, deals: 33 },
]

const carrierData = [
  { name: 'Aetna', value: 35, color: '#8b5cf6' },
  { name: 'American Amicable', value: 28, color: '#10b981' },
  { name: 'Aflac', value: 20, color: '#f59e0b' },
  { name: 'Liberty Bankers', value: 17, color: '#ef4444' },
]

const productData = [
  { name: 'Clear Choice 0-79', deals: 42, production: 89000 },
  { name: 'Final Expense Level', deals: 38, production: 76000 },
  { name: 'Accendo Modified', deals: 28, production: 52000 },
  { name: 'Accendo Preferred', deals: 22, production: 45000 },
]

const agentPerformance = [
  { name: 'Steven Sharko', deals: 18, production: 42500, commissions: 8500, trend: 'up' },
  { name: 'Ethan Neumann', deals: 15, production: 35000, commissions: 7000, trend: 'up' },
  { name: 'Luca Baski', deals: 14, production: 32000, commissions: 6400, trend: 'down' },
  { name: 'Wyatt Perichitch', deals: 12, production: 28000, commissions: 5600, trend: 'up' },
  { name: 'Caiden Clayton', deals: 11, production: 25000, commissions: 5000, trend: 'up' },
]

export default function Analytics() {
  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-foreground">Analytics Overview</h1>
          <div className="flex items-center space-x-4">
            <Select defaultValue="month">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Production</p>
                <p className="text-2xl font-bold text-foreground">$264.0K</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+12.5%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Commissions</p>
                <p className="text-2xl font-bold text-foreground">$52.8K</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+8.2%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold text-foreground">152</p>
                <div className="flex items-center mt-2">
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600">-2.1%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                <p className="text-2xl font-bold text-foreground">$1,737</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+14.8%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Production Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Production & Commission Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      `$${value.toLocaleString()}`,
                      name === 'production' ? 'Production' : 'Commissions'
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="production"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="production"
                  />
                  <Line
                    type="monotone"
                    dataKey="commissions"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="commissions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Carrier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Carrier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={carrierData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {carrierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Performance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Top Products by Production</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'production' ? `$${value.toLocaleString()}` : value,
                    name === 'production' ? 'Production' : 'Deals'
                  ]}
                />
                <Bar dataKey="production" fill="#8b5cf6" name="production" />
                <Bar dataKey="deals" fill="#10b981" name="deals" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Agent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Agent</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Deals</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Production</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Commissions</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((agent, index) => (
                  <tr key={agent.name} className="border-b border-border hover:bg-accent">
                    <td className="py-3 px-4 font-medium text-foreground">{agent.name}</td>
                    <td className="py-3 px-4 text-center">{agent.deals}</td>
                    <td className="py-3 px-4 text-center">${agent.production.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">${agent.commissions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      {agent.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </td>
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