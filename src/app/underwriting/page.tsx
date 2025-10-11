"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Calculator,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Users,
  DollarSign,
  Shield,
  Target,
  Activity,
  BarChart3,
  PieChart,
  Settings,
  Plus,
  Search,
  Filter,
  Download
} from "lucide-react"

interface QuoteRecord {
  id: string
  customerName: string
  policyType: string
  status: 'pending' | 'approved' | 'declined' | 'under-review'
  premium: number
  coverage: number
  createdDate: string
  lastUpdated: string
  riskScore: number
  agent: string
}

interface UnderwritingStats {
  totalQuotes: number
  approvedQuotes: number
  pendingReview: number
  declinedQuotes: number
  averagePremium: number
  totalCoverage: number
  conversionRate: number
  averageProcessingTime: string
}

const mockQuotes: QuoteRecord[] = [
  {
    id: "UW-2024-001",
    customerName: "John Anderson",
    policyType: "Term Life Insurance",
    status: "approved",
    premium: 85.50,
    coverage: 500000,
    createdDate: "2024-01-15",
    lastUpdated: "2024-01-16",
    riskScore: 75,
    agent: "Sarah Johnson"
  },
  {
    id: "UW-2024-002",
    customerName: "Emily Rodriguez",
    policyType: "Whole Life Insurance",
    status: "under-review",
    premium: 245.00,
    coverage: 750000,
    createdDate: "2024-01-14",
    lastUpdated: "2024-01-15",
    riskScore: 65,
    agent: "Michael Chen"
  },
  {
    id: "UW-2024-003",
    customerName: "David Thompson",
    policyType: "Auto Insurance",
    status: "pending",
    premium: 156.25,
    coverage: 100000,
    createdDate: "2024-01-13",
    lastUpdated: "2024-01-14",
    riskScore: 80,
    agent: "Lisa Parker"
  },
  {
    id: "UW-2024-004",
    customerName: "Sarah Williams",
    policyType: "Home Insurance",
    status: "declined",
    premium: 0,
    coverage: 0,
    createdDate: "2024-01-12",
    lastUpdated: "2024-01-13",
    riskScore: 45,
    agent: "James Wilson"
  },
  {
    id: "UW-2024-005",
    customerName: "Michael Foster",
    policyType: "Disability Insurance",
    status: "approved",
    premium: 125.75,
    coverage: 2500,
    createdDate: "2024-01-11",
    lastUpdated: "2024-01-12",
    riskScore: 85,
    agent: "Sarah Johnson"
  }
]

const stats: UnderwritingStats = {
  totalQuotes: 156,
  approvedQuotes: 89,
  pendingReview: 23,
  declinedQuotes: 12,
  averagePremium: 142.50,
  totalCoverage: 45000000,
  conversionRate: 71.2,
  averageProcessingTime: "2.3 days"
}

const riskFactors = [
  { name: "Age Demographics", score: 78, trend: "up" },
  { name: "Medical History", score: 65, trend: "stable" },
  { name: "Lifestyle Factors", score: 82, trend: "up" },
  { name: "Financial Profile", score: 74, trend: "down" },
  { name: "Geographic Risk", score: 88, trend: "up" }
]

export default function UnderwritingDashboard() {
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredQuotes = mockQuotes.filter(quote => {
    const matchesSearch = quote.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         quote.policyType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         quote.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === "all" || quote.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "text-green-500 bg-green-500/20"
      case "declined": return "text-red-500 bg-red-500/20"
      case "under-review": return "text-yellow-500 bg-yellow-500/20"
      case "pending": return "text-blue-500 bg-blue-500/20"
      default: return "text-muted-foreground bg-muted"
    }
  }

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Underwriting Dashboard</h1>
          <p className="text-muted-foreground mt-1">Comprehensive insurance underwriting and risk assessment</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/underwriting/quote">
            <Button className="btn-gradient">
              <Plus className="h-4 w-4 mr-2" />
              New Quote
            </Button>
          </Link>
          <Link href="/underwriting/risk">
            <Button variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Risk Assessment
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/underwriting/quote">
          <Card className="professional-card p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Calculator className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Quote Engine</h3>
                <p className="text-sm text-muted-foreground">Generate instant quotes</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/underwriting/risk">
          <Card className="professional-card p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <Shield className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Risk Assessment</h3>
                <p className="text-sm text-muted-foreground">Analyze customer risk</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/underwriting/proposals">
          <Card className="professional-card p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <FileText className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Proposals</h3>
                <p className="text-sm text-muted-foreground">Manage policy proposals</p>
              </div>
            </div>
          </Card>
        </Link>

        <Card className="professional-card p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Settings className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Settings</h3>
              <p className="text-sm text-muted-foreground">Configure underwriting rules</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Quotes</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalQuotes}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold text-foreground">{stats.approvedQuotes}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold text-foreground">{stats.pendingReview}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Premium</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.averagePremium)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="professional-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Key Metrics</h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Conversion Rate</span>
              <span className="font-semibold text-green-500">{stats.conversionRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Coverage</span>
              <span className="font-semibold text-foreground">{formatCurrency(stats.totalCoverage)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Processing Time</span>
              <span className="font-semibold text-foreground">{stats.averageProcessingTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Decline Rate</span>
              <span className="font-semibold text-red-500">
                {((stats.declinedQuotes / stats.totalQuotes) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Risk Factors Analysis</h3>
            <Target className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {riskFactors.map((factor, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{factor.name}</span>
                <div className="flex items-center space-x-2">
                  <span className={cn("font-semibold", getRiskScoreColor(factor.score))}>
                    {factor.score}%
                  </span>
                  <div className={cn(
                    "flex items-center",
                    factor.trend === "up" ? "text-green-500" :
                    factor.trend === "down" ? "text-red-500" : "text-yellow-500"
                  )}>
                    <Activity className="h-3 w-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Quotes */}
      <Card className="professional-card">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Recent Quotes</h2>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search quotes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
              <div className="flex space-x-2">
                {[
                  { id: "all", label: "All" },
                  { id: "pending", label: "Pending" },
                  { id: "approved", label: "Approved" },
                  { id: "under-review", label: "Review" }
                ].map((filter) => (
                  <Button
                    key={filter.id}
                    variant={selectedStatus === filter.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStatus(filter.id)}
                    className={selectedStatus === filter.id ? "btn-gradient" : ""}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Quote ID</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Policy Type</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Premium</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Coverage</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Risk Score</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="border-b border-border hover:bg-accent/50">
                  <td className="p-4">
                    <span className="font-medium text-primary">{quote.id}</span>
                  </td>
                  <td className="p-4">
                    <div>
                      <span className="font-medium text-foreground">{quote.customerName}</span>
                      <p className="text-sm text-muted-foreground">Agent: {quote.agent}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-foreground">{quote.policyType}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-foreground">
                      {quote.premium > 0 ? formatCurrency(quote.premium) : "-"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-foreground">
                      {quote.coverage > 0 ? formatCurrency(quote.coverage) : "-"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={cn("font-medium", getRiskScoreColor(quote.riskScore))}>
                      {quote.riskScore}%
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge className={getStatusColor(quote.status)}>
                      {quote.status.replace("-", " ")}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="ghost">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}