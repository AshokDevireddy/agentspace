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
import { Calendar, Download, Filter, Upload, FileText, AlertCircle } from "lucide-react"
import { useState, useEffect } from 'react'
import UploadPolicyReportsModal from '@/components/modals/upload-policy-reports-modal'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * Retrieves the agency ID for the current user
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID (auth_user_id)
 * @returns Promise<string> - The agency ID
 */
async function getAgencyId(supabase: any, userId: string): Promise<string> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', userId)
      .single()

    if (error || !user) {
      throw new Error('Failed to fetch user agency')
    }

    if (!user.agency_id) {
      throw new Error('User is not associated with an agency')
    }

    return user.agency_id
  } catch (error) {
    console.error('Error fetching agency ID:', error)
    throw error instanceof Error ? error : new Error('Failed to retrieve agency ID')
  }
}

/**
 * Retrieves the user's role from the users table
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID (auth_user_id)
 * @returns Promise<string> - The user's role
 */
async function getUserRole(supabase: any, userId: string): Promise<string> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', userId)
      .single()

    if (error || !user) {
      throw new Error('Failed to fetch user role')
    }

    return user.role || 'agent'
  } catch (error) {
    console.error('Error fetching user role:', error)
    return 'agent' // Default to agent if role fetch fails
  }
}

// Helper functions for data processing
const getCarrierPersistencyData = (carrier: any) => {
  if (!carrier.timeRanges) return null
  
  return [
    { period: '3 Months', persistency: carrier.timeRanges["3"]?.positivePercentage || 0 },
    { period: '6 Months', persistency: carrier.timeRanges["6"]?.positivePercentage || 0 },
    { period: '9 Months', persistency: carrier.timeRanges["9"]?.positivePercentage || 0 },
    { period: 'All Time', persistency: carrier.timeRanges["All"]?.positivePercentage || 0 },
  ]
}

const getCarrierPolicyData = (carrier: any) => {
  if (!carrier.timeRanges) return null
  
  return [
    { period: '3 Months', active: carrier.timeRanges["3"]?.positiveCount || 0, inactive: carrier.timeRanges["3"]?.negativeCount || 0 },
    { period: '6 Months', active: carrier.timeRanges["6"]?.positiveCount || 0, inactive: carrier.timeRanges["6"]?.negativeCount || 0 },
    { period: '9 Months', active: carrier.timeRanges["9"]?.positiveCount || 0, inactive: carrier.timeRanges["9"]?.negativeCount || 0 },
    { period: 'All Time', active: carrier.timeRanges["All"]?.positiveCount || 0, inactive: carrier.timeRanges["All"]?.negativeCount || 0 },
  ]
}

const getStatusBreakdownData = (carrier: any) => {
  if (!carrier.statusBreakdowns || !carrier.statusBreakdowns["All"]) return []
  
  const breakdown = carrier.statusBreakdowns["All"]
  const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899']
  
  return Object.entries(breakdown).map(([status, data]: [string, any], index) => ({
    name: status,
    value: data.count || 0,
    color: colors[index % colors.length]
  })).filter(item => item.value > 0)
}

const generateCarrierComparisonData = (persistencyData: any) => {
  if (!persistencyData?.carriers) return { activePoliciesByCarrier: [], inactivePoliciesByCarrier: [], carrierComparisonData: [] }
  
  const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']
  
  const activePoliciesByCarrier = persistencyData.carriers.map((carrier: any, index: number) => ({
    name: carrier.carrier,
    value: carrier.totalPolicies ? Math.round(carrier.totalPolicies * (carrier.persistencyRate / 100)) : 0,
    color: colors[index % colors.length]
  }))
  
  const inactivePoliciesByCarrier = persistencyData.carriers.map((carrier: any, index: number) => ({
    name: carrier.carrier,
    value: carrier.totalPolicies ? Math.round(carrier.totalPolicies * ((100 - carrier.persistencyRate) / 100)) : 0,
    color: colors[index % colors.length]
  }))
  
  const carrierComparisonData = persistencyData.carriers.map((carrier: any) => ({
    carrier: carrier.carrier,
    persistency: carrier.persistencyRate || 0
  }))
  
  return {
    activePoliciesByCarrier,
    inactivePoliciesByCarrier,
    carrierComparisonData
  }
}

export default function Persistency() {
  const [showCarrierComparison, setShowCarrierComparison] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('agent')
  const router = useRouter()
  
  // Dynamic persistency data from Supabase RPC
  const [persistencyData, setPersistencyData] = useState<any>(null)
  
  // Fetch persistency data from Supabase RPC
  useEffect(() => {
    const fetchPersistencyData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const supabase = createClient()
        
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          throw new Error('User not authenticated')
        }
        
        // Get user role
        const role = await getUserRole(supabase, user.id)
        setUserRole(role)
        
        // Get agency ID for the user
        const agencyId = await getAgencyId(supabase, user.id)
        
        // Call the RPC function
        const { data, error: rpcError } = await supabase.rpc('analyze_persistency_for_deals', { 
          agency_id: agencyId 
        })
        
        if (rpcError) {
          throw new Error(`RPC Error: ${rpcError.message}`)
        }
        
        if (data && data.carriers && data.carriers.length > 0) {
          setPersistencyData(data)
        } else {
          // No data returned - this is not an error, just empty state
          setPersistencyData(null)
        }
        
      } catch (err) {
        console.error('Error fetching persistency data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch persistency data')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchPersistencyData()
  }, [])

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

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading persistency data...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-600">
              Please check your connection and try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show empty state - no persistency data available
  if (!persistencyData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto p-6">
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="flex justify-center mb-6">
              <div className="bg-blue-50 rounded-full p-4">
                <FileText className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              No Persistency Data Available
            </h2>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Persistency analytics are not available because either no policy reports have been uploaded yet, 
              or there are no deals in the database for your agency.
            </p>
            
            {userRole === 'admin' ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-blue-900">Admin Access</h3>
                  </div>
                  <p className="text-blue-700 text-sm">
                    As an admin, you can upload policy reports to start generating persistency analytics.
                  </p>
                </div>
                
                <Button 
                  onClick={() => router.push('/configuration?tab=policy-reports')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Go to Policy Reports Upload
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 mr-2" />
                    <h3 className="font-medium text-amber-900">No Data Available</h3>
                  </div>
                  <p className="text-amber-700 text-sm">
                    No deals exist for your agency in the database. Contact your administrator to upload policy reports.
                  </p>
                </div>
                
                <Button 
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="w-full"
                >
                  Return to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Generate dynamic data based on current persistency data (only after data is loaded)
  const overallPersistencyData = [
    { period: '3 Months', persistency: persistencyData.overall_analytics.timeRanges["3"].activePercentage },
    { period: '6 Months', persistency: persistencyData.overall_analytics.timeRanges["6"].activePercentage },
    { period: '9 Months', persistency: persistencyData.overall_analytics.timeRanges["9"].activePercentage },
    { period: 'All Time', persistency: persistencyData.overall_analytics.timeRanges["All"].activePercentage },
  ]

  const overallPolicyData = [
    { period: '3 Months', active: persistencyData.overall_analytics.timeRanges["3"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["3"].inactiveCount },
    { period: '6 Months', active: persistencyData.overall_analytics.timeRanges["6"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["6"].inactiveCount },
    { period: '9 Months', active: persistencyData.overall_analytics.timeRanges["9"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["9"].inactiveCount },
    { period: 'All Time', active: persistencyData.overall_analytics.timeRanges["All"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["All"].inactiveCount },
  ]

  const { activePoliciesByCarrier, inactivePoliciesByCarrier, carrierComparisonData } = generateCarrierComparisonData(persistencyData)

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
              variant="outline"
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Reports</span>
            </Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export Data</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Overall Persistency */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Overall Persistency</h3>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">All Time</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{persistencyData.overall_analytics.overallPersistency}%</p>
            <p className="text-sm text-gray-600">All Carriers Combined</p>
            <p className="text-xs text-gray-500">Total Policies: {persistencyData.overall_analytics.activeCount + persistencyData.overall_analytics.inactiveCount}</p>
          </div>
        </div>

        {/* Active Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Active Policies</h3>
            <p className="text-3xl font-bold text-gray-900">{persistencyData.overall_analytics.activeCount.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Persisting Across All Carriers</p>
          </div>
        </div>

        {/* Inactive Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Inactive Policies</h3>
            <p className="text-3xl font-bold text-gray-900">{persistencyData.overall_analytics.inactiveCount.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Persisting Across All Carriers</p>
          </div>
        </div>

        {/* Total Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Total Policies</h3>
            <p className="text-3xl font-bold text-gray-900">{(persistencyData.overall_analytics.activeCount + persistencyData.overall_analytics.inactiveCount).toLocaleString()}</p>
            <p className="text-sm text-gray-600">All Carriers Combined</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Active and Inactive Policies */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active and Inactive Policies</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overallPolicyData} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Time Period', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
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
                      value.toLocaleString(),
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

        {/* Persistency Trends */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Persistency Trends</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overallPersistencyData} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Time Period', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Persistency Rate (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
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
                      'Persistency Rate'
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="persistency"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#8b5cf6', strokeWidth: 2 }}
                    name="Persistency Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Carrier Comparison Section */}
      <div className="mt-12">
          <h2 className="text-2xl font-light text-gray-600 mb-6">Carrier Comparison</h2>
        
        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Active Policies Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Active Policies by Carrier</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
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
                      {activePoliciesByCarrier.map((entry: any, index: number) => (
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
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Inactive Policies by Carrier</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
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
                      {inactivePoliciesByCarrier.map((entry: any, index: number) => (
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
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Persistency Rates by Carrier</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
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
                      'Persistency Rate'
                    ]}
                  />
                  <Bar dataKey="persistency" fill="#8b5cf6" name="Persistency Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Analysis Section */}
      <div className="mt-12">
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
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Distribution of Leads</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Not Placed', value: 800, color: '#ef4444' },
                        { name: 'Active', value: 654, color: '#10b981' },
                        { name: 'Inactive', value: 346, color: '#f59e0b' },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Not Placed', value: 800, color: '#ef4444' },
                        { name: 'Active', value: 654, color: '#10b981' },
                        { name: 'Inactive', value: 346, color: '#f59e0b' },
                      ].map((entry, index) => (
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
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Placement Rate by Lead Type</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Referrals', value: 75.2, color: '#8b5cf6' },
                        { name: 'Ads', value: 45.8, color: '#10b981' },
                        { name: 'Third Party', value: 38.4, color: '#f59e0b' },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Referrals', value: 75.2, color: '#8b5cf6' },
                        { name: 'Ads', value: 45.8, color: '#10b981' },
                        { name: 'Third Party', value: 38.4, color: '#f59e0b' },
                      ].map((entry, index) => (
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
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lead Placement by Type</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { leadType: 'Referrals', placed: 75.2, notPlaced: 24.8, placedCount: 752, notPlacedCount: 248 },
                    { leadType: 'Ads', placed: 45.8, notPlaced: 54.2, placedCount: 458, notPlacedCount: 542 },
                    { leadType: 'Third Party', placed: 38.4, notPlaced: 61.6, placedCount: 384, notPlacedCount: 616 },
                  ]} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
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
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lead Conversion to Active Customers</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { leadType: 'Referrals', activeConversion: 65.4, inactiveConversion: 34.6, activeCount: 491, inactiveCount: 261 },
                    { leadType: 'Ads', activeConversion: 58.2, inactiveConversion: 41.8, activeCount: 267, inactiveCount: 191 },
                    { leadType: 'Third Party', activeConversion: 52.1, inactiveConversion: 47.9, activeCount: 200, inactiveCount: 184 },
                  ]} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
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
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Average Leads Needed to Acquire One Customer</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { leadType: 'Referrals', leadsPerCustomer: 2.04, totalLeads: 1000, activeCustomers: 491 },
                    { leadType: 'Ads', leadsPerCustomer: 3.75, totalLeads: 1000, activeCustomers: 267 },
                    { leadType: 'Third Party', leadsPerCustomer: 5.00, totalLeads: 1000, activeCustomers: 200 },
                  ]} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
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
                      {[
                        { leadType: 'Referrals', leadsPerCustomer: 2.04, totalLeads: 1000, activeCustomers: 491 },
                        { leadType: 'Ads', leadsPerCustomer: 3.75, totalLeads: 1000, activeCustomers: 267 },
                        { leadType: 'Third Party', leadsPerCustomer: 5.00, totalLeads: 1000, activeCustomers: 200 },
                      ].map((entry, index) => (
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

      {/* Individual Carrier Sections */}
      {persistencyData.carriers.map((carrier: any, index: number) => (
        <div key={carrier.carrier} className="mt-12">
          <h2 className="text-2xl font-light text-gray-600 mb-6">{carrier.carrier}</h2>
          
          {/* Carrier Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Persistency Rate</h3>
                <p className="text-3xl font-bold text-gray-900">{carrier.persistencyRate || 'N/A'}%</p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Total Policies</h3>
                <p className="text-3xl font-bold text-gray-900">{carrier.totalPolicies?.toLocaleString() || 'N/A'}</p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Active Policies</h3>
                <p className="text-3xl font-bold text-gray-900">{carrier.timeRanges?.["All"]?.positiveCount?.toLocaleString() || 'N/A'}</p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Inactive Policies</h3>
                <p className="text-3xl font-bold text-gray-900">{carrier.timeRanges?.["All"]?.negativeCount?.toLocaleString() || 'N/A'}</p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
          </div>

          {/* Carrier Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <div className="border border-gray-200 rounded-lg bg-white">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold text-gray-900">Status Breakdown</h3>
              </div>
              <div className="px-6 pb-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getStatusBreakdownData(carrier)}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {getStatusBreakdownData(carrier).map((entry, index) => (
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
                        formatter={(value, name) => [value, 'Policies']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Persistency Over Time */}
            {getCarrierPersistencyData(carrier) && (
              <div className="border border-gray-200 rounded-lg bg-white">
                <div className="p-6 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Persistency Over Time</h3>
                </div>
                <div className="px-6 pb-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getCarrierPersistencyData(carrier) || []} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="period" 
                          tick={{ fontSize: 12, fill: '#666' }}
                          axisLine={{ stroke: '#e0e0e0' }}
                          label={{ value: 'Time Period', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                          domain={['dataMin', 'dataMax']}
                          padding={{ left: 30, right: 30 }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12, fill: '#666' }}
                          axisLine={{ stroke: '#e0e0e0' }}
                          label={{ value: 'Persistency Rate (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
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
                            'Persistency Rate'
                          ]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="persistency" 
                          stroke="#8b5cf6" 
                          strokeWidth={3}
                          dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                          activeDot={{ r: 8, stroke: '#8b5cf6', strokeWidth: 2 }}
                          name="Persistency Rate"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}


      </div>
      
      {/* Upload Policy Reports Modal */}
      <UploadPolicyReportsModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </div>
  )
}
