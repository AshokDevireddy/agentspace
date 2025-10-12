"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { Calendar, Download, Filter, Upload } from "lucide-react"
import { useState, useEffect } from 'react'
import UploadPolicyReportsModal from '@/components/modals/upload-policy-reports-modal'

// Persistency data
const persistencyData = [
  { period: 'All Time', persistency: 68.2, placement: 52.1 },
  { period: '9 Months', persistency: 67.8, placement: 49.7 },
  { period: '6 Months', persistency: 65.1, placement: 51.3 },
  { period: '3 Months', persistency: 65.4, placement: 50.0 },
]

const policyData = [
  { period: 'All Time', active: 822, inactive: 427 },
  { period: '9 Months', active: 756, inactive: 389 },
  { period: '6 Months', active: 634, inactive: 312 },
  { period: '3 Months', active: 654, inactive: 346 },
]

// Carrier data for pie charts
const activePoliciesByCarrier = [
  { name: 'Aetna', value: 245, color: '#8b5cf6' },
  { name: 'Aflac', value: 189, color: '#10b981' },
  { name: 'Royal Neighbors', value: 156, color: '#f59e0b' },
  { name: 'American Amicable', value: 134, color: '#ef4444' },
  { name: 'American Home Life', value: 112, color: '#84cc16' },
  { name: 'Combined', value: 98, color: '#06b6d4' },
]

const inactivePoliciesByCarrier = [
  { name: 'Aetna', value: 98, color: '#8b5cf6' },
  { name: 'Aflac', value: 89, color: '#10b981' },
  { name: 'Royal Neighbors', value: 85, color: '#f59e0b' },
  { name: 'American Amicable', value: 86, color: '#ef4444' },
  { name: 'American Home Life', value: 78, color: '#84cc16' },
  { name: 'Combined', value: 69, color: '#06b6d4' },
]

// Carrier comparison data for bar chart
const carrierComparisonData = [
  { carrier: 'Aetna', persistency: 72.5, placement: 68.3 },
  { carrier: 'Aflac', persistency: 68.3, placement: 64.7 },
  { carrier: 'Royal Neighbors', persistency: 64.7, placement: 61.2 },
  { carrier: 'American Amicable', persistency: 61.2, placement: 58.9 },
  { carrier: 'American Home Life', persistency: 58.9, placement: 55.4 },
  { carrier: 'Combined', persistency: 55.4, placement: 52.1 },
]

// Leads Analysis data
const leadsDistributionData = [
  { name: 'Not Placed', value: 800, color: '#ef4444' },
  { name: 'Active', value: 654, color: '#10b981' },
  { name: 'Inactive', value: 346, color: '#f59e0b' },
]

const placementRateByLeadType = [
  { name: 'Referrals', value: 75.2, color: '#8b5cf6' },
  { name: 'Ads', value: 45.8, color: '#10b981' },
  { name: 'Third Party', value: 38.4, color: '#f59e0b' },
]

const leadPlacementData = [
  { leadType: 'Referrals', placed: 75.2, notPlaced: 24.8, placedCount: 752, notPlacedCount: 248 },
  { leadType: 'Ads', placed: 45.8, notPlaced: 54.2, placedCount: 458, notPlacedCount: 542 },
  { leadType: 'Third Party', placed: 38.4, notPlaced: 61.6, placedCount: 384, notPlacedCount: 616 },
]

const leadConversionData = [
  { leadType: 'Referrals', activeConversion: 65.4, inactiveConversion: 34.6, activeCount: 491, inactiveCount: 261 },
  { leadType: 'Ads', activeConversion: 58.2, inactiveConversion: 41.8, activeCount: 267, inactiveCount: 191 },
  { leadType: 'Third Party', activeConversion: 52.1, inactiveConversion: 47.9, activeCount: 200, inactiveCount: 184 },
]

const leadsPerCustomerData = [
  { leadType: 'Referrals', leadsPerCustomer: 2.04, totalLeads: 1000, activeCustomers: 491 },
  { leadType: 'Ads', leadsPerCustomer: 3.75, totalLeads: 1000, activeCustomers: 267 },
  { leadType: 'Third Party', leadsPerCustomer: 5.00, totalLeads: 1000, activeCustomers: 200 },
]

export default function Persistency() {
  const [showCarrierComparison, setShowCarrierComparison] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      const windowHeight = window.innerHeight
      
      // Show carrier comparison when user scrolls down (more sensitive trigger)
      if (scrollPosition > 200) {
        setShowCarrierComparison(true)
      } else {
        setShowCarrierComparison(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white -m-4 lg:-m-6">
      <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Persistency</h1>
            <h2 className="text-2xl font-light text-gray-600 mt-2">Overall Analytics</h2>
          </div>
          <div className="flex items-center space-x-4">
            <Select defaultValue="3months">
              <SelectTrigger className="w-40 text-black bg-white border-gray-300">
                <SelectValue className="text-black" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                <SelectItem value="3months" className="text-black hover:bg-gray-100">3 Months</SelectItem>
                <SelectItem value="6months" className="text-black hover:bg-gray-100">6 Months</SelectItem>
                <SelectItem value="9months" className="text-black hover:bg-gray-100">9 Months</SelectItem>
                <SelectItem value="alltime" className="text-black hover:bg-gray-100">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-black text-white hover:bg-gray-800 px-4 py-2"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Policy Reports
            </Button>
          </div>
        </div>
      </div>


      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Overall Placement */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Overall Placement</h3>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">3 Months</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">50%</p>
            <p className="text-sm text-gray-600">All Carriers Combined</p>
            <p className="text-xs text-gray-500">Total Leads: 2000</p>
          </div>
        </div>

        {/* Overall Persistency */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Overall Persistency</h3>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">3 Months</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">65.4%</p>
            <p className="text-sm text-gray-600">All Carriers Combined</p>
            <p className="text-xs text-gray-500">Total Policies: 1000</p>
          </div>
        </div>

        {/* Active Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Active Policies</h3>
            <p className="text-3xl font-bold text-gray-900">654</p>
            <p className="text-sm text-gray-600">Persisting Across All Carriers</p>
          </div>
        </div>

        {/* Inactive Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Inactive Policies</h3>
            <p className="text-3xl font-bold text-gray-900">346</p>
            <p className="text-sm text-gray-600">Persisting Across All Carriers</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Active/Inactive Policies */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active and Inactive Policies</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={policyData} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Date Range', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Number of Policies', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      value,
                      name === 'active' ? 'Active Policies' : 'Inactive Policies'
                    ]}
                  />
                  <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar dataKey="active" fill="#10b981" name="Active Policies" />
                  <Bar dataKey="inactive" fill="#ef4444" name="Inactive Policies" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Line Chart - Persistency Trends */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Persistency & Placement Trends</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={persistencyData} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Date Range', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      `${value}%`,
                      name === 'persistency' ? 'Persistency Rate' : 'Placement Rate'
                    ]}
                  />
                  <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Line
                    type="monotone"
                    dataKey="persistency"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2 }}
                    name="Persistency Rate"
                  />
                  <Line
                    type="monotone"
                    dataKey="placement"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2 }}
                    name="Placement Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Carrier Comparison Section */}
      <div className="mt-8">
          <h2 className="text-2xl font-light text-gray-600 mb-6">Carrier Comparison</h2>
        
        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Active Policies Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Active Policies by Carrier</h3>
            </div>
            <div className="px-4 pb-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activePoliciesByCarrier}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {activePoliciesByCarrier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [value, 'Active Policies']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Inactive Policies Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Inactive Policies by Carrier</h3>
            </div>
            <div className="px-4 pb-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inactivePoliciesByCarrier}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {inactivePoliciesByCarrier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [value, 'Inactive Policies']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Carrier Comparison Bar Chart */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-4 pb-2">
            <h3 className="text-lg font-semibold text-gray-900">Placement vs Persistency Rates by Carrier</h3>
          </div>
          <div className="px-4 pb-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierComparisonData} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="carrier" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Carrier', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      `${value}%`,
                      name === 'persistency' ? 'Persistency Rate' : 'Placement Rate'
                    ]}
                  />
                  <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar dataKey="persistency" fill="#8b5cf6" name="Persistency Rate" />
                  <Bar dataKey="placement" fill="#10b981" name="Placement Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Analysis Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-light text-gray-600 mb-6">Leads Analysis</h2>
        
        {/* Summary Statistics */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Average Leads Needed</h3>
                <p className="text-3xl font-bold text-gray-900">2.04</p>
                <p className="text-sm text-gray-600">For One Active Customer</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Overall Lead Placement</h3>
                <p className="text-3xl font-bold text-gray-900">53.1%</p>
                <p className="text-sm text-gray-600">Across All Lead Types</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Active Conversion Rate</h3>
                <p className="text-3xl font-bold text-gray-900">58.6%</p>
                <p className="text-sm text-gray-600">From Placed Leads</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Lead Distribution Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Distribution of Leads</h3>
            </div>
            <div className="px-4 pb-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadsDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {leadsDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [value, 'Leads']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Placement Rate by Lead Type Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Placement Rate by Lead Type</h3>
            </div>
            <div className="px-4 pb-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={placementRateByLeadType}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {placementRateByLeadType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [`${value}%`, 'Placement Rate']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Placement Bar Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Lead Placement by Type</h3>
            </div>
            <div className="px-4 pb-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadPlacementData} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="leadType" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Lead Type', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                      domain={['dataMin', 'dataMax']}
                      padding={{ left: 30, right: 30 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Placement Rate (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name, props) => {
                        const data = props.payload
                        if (name === 'placed') {
                          return [`Placed Leads: ${value}% (${data.placedCount} leads)`, '']
                        } else if (name === 'notPlaced') {
                          return [`Not Placed Leads: ${value}% (${data.notPlacedCount} leads)`, '']
                        }
                        return [value, name]
                      }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="placed" fill="#10b981" name="Placed Leads" />
                    <Bar dataKey="notPlaced" fill="#ef4444" name="Not Placed Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Lead Conversion Bar Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Lead Conversion to Active Customers</h3>
            </div>
            <div className="px-4 pb-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadConversionData} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="leadType" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Lead Type', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                      domain={['dataMin', 'dataMax']}
                      padding={{ left: 30, right: 30 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Conversion Rate (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name, props) => {
                        const data = props.payload
                        if (name === 'activeConversion') {
                          return [`${value}% (${data.activeCount} leads)`, 'Active Conversion']
                        } else if (name === 'inactiveConversion') {
                          return [`${value}% (${data.inactiveCount} leads)`, 'Inactive Conversion']
                        }
                        return [`${value}%`, name]
                      }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="activeConversion" fill="#10b981" name="Active Conversion" />
                    <Bar dataKey="inactiveConversion" fill="#f59e0b" name="Inactive Conversion" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Leads Per Customer Chart */}
        <div className="mt-6">
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Average Leads Needed to Acquire One Customer</h3>
            </div>
            <div className="px-4 pb-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadsPerCustomerData} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="leadType" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Lead Type', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                      domain={['dataMin', 'dataMax']}
                      padding={{ left: 30, right: 30 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Leads Per Customer', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [`${value} leads`]}
                    />
                    <Bar dataKey="leadsPerCustomer" fill="#8b5cf6" name="Leads Per Customer">
                      {leadsPerCustomerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#8b5cf6' : index === 1 ? '#10b981' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      
      {/* Upload Policy Reports Modal */}
      <UploadPolicyReportsModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </div>
  )
}
