"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Users,
  MapPin,
  Car,
  Home,
  Heart,
  ArrowLeft,
  Search,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react"

interface RiskFactor {
  id: string
  name: string
  category: string
  weight: number
  score: number
  status: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendations: string[]
}

interface RiskAssessment {
  id: string
  customerName: string
  policyType: string
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: RiskFactor[]
  lastUpdated: string
  assessedBy: string
}

const mockRiskFactors: RiskFactor[] = [
  {
    id: "age",
    name: "Age Factor",
    category: "Demographics",
    weight: 25,
    score: 85,
    status: "low",
    description: "Customer age indicates lower risk profile",
    recommendations: ["Continue monitoring age-related changes", "Consider age-based discounts"]
  },
  {
    id: "location",
    name: "Geographic Risk",
    category: "Location",
    weight: 20,
    score: 60,
    status: "medium",
    description: "Moderate risk area with some environmental concerns",
    recommendations: ["Review local crime statistics", "Consider additional security measures"]
  },
  {
    id: "credit",
    name: "Credit Score",
    category: "Financial",
    weight: 30,
    score: 75,
    status: "low",
    description: "Good credit history indicates financial responsibility",
    recommendations: ["Monitor credit changes", "Offer credit-based discounts"]
  },
  {
    id: "claims",
    name: "Claims History",
    category: "Historical",
    weight: 25,
    score: 40,
    status: "high",
    description: "Multiple claims in the past 3 years",
    recommendations: ["Investigate claim patterns", "Consider higher deductibles", "Implement loss prevention measures"]
  }
]

const mockAssessments: RiskAssessment[] = [
  {
    id: "RA-2024-001",
    customerName: "John Anderson",
    policyType: "Auto Insurance",
    overallScore: 72,
    riskLevel: "medium",
    factors: mockRiskFactors,
    lastUpdated: "2024-01-15",
    assessedBy: "Sarah Johnson"
  },
  {
    id: "RA-2024-002",
    customerName: "Emily Rodriguez",
    policyType: "Home Insurance",
    overallScore: 85,
    riskLevel: "low",
    factors: mockRiskFactors.map(f => ({ ...f, score: f.score + 10 })),
    lastUpdated: "2024-01-14",
    assessedBy: "Michael Chen"
  },
  {
    id: "RA-2024-003",
    customerName: "David Thompson",
    policyType: "Life Insurance",
    overallScore: 45,
    riskLevel: "high",
    factors: mockRiskFactors.map(f => ({ ...f, score: f.score - 20 })),
    lastUpdated: "2024-01-13",
    assessedBy: "Lisa Parker"
  }
]

export default function RiskAssessmentPage() {
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(mockAssessments[0])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRiskLevel, setFilterRiskLevel] = useState("all")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const filteredAssessments = mockAssessments.filter(assessment => {
    const matchesSearch = assessment.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         assessment.policyType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         assessment.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterRiskLevel === "all" || assessment.riskLevel === filterRiskLevel
    return matchesSearch && matchesFilter
  })

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "low": return "text-green-500 bg-green-500/20"
      case "medium": return "text-yellow-500 bg-yellow-500/20"
      case "high": return "text-orange-500 bg-orange-500/20"
      case "critical": return "text-red-500 bg-red-500/20"
      default: return "text-muted-foreground bg-muted"
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "low": return CheckCircle
      case "medium": return AlertTriangle
      case "high": return AlertTriangle
      case "critical": return XCircle
      default: return Shield
    }
  }

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true)
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsAnalyzing(false)
  }

  const riskDistribution = {
    low: mockAssessments.filter(a => a.riskLevel === "low").length,
    medium: mockAssessments.filter(a => a.riskLevel === "medium").length,
    high: mockAssessments.filter(a => a.riskLevel === "high").length,
    critical: mockAssessments.filter(a => a.riskLevel === "critical").length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/underwriting">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gradient">Risk Assessment</h1>
            <p className="text-muted-foreground mt-1">Comprehensive risk analysis and evaluation</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="btn-gradient"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Risk Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Low Risk</p>
              <p className="text-2xl font-bold text-foreground">{riskDistribution.low}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Medium Risk</p>
              <p className="text-2xl font-bold text-foreground">{riskDistribution.medium}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">High Risk</p>
              <p className="text-2xl font-bold text-foreground">{riskDistribution.high}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical Risk</p>
              <p className="text-2xl font-bold text-foreground">{riskDistribution.critical}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assessment List */}
        <div className="lg:col-span-1">
          <Card className="professional-card">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Risk Assessments</h2>
                <Badge variant="outline">{filteredAssessments.length} assessments</Badge>
              </div>

              {/* Search and Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search assessments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex space-x-2">
                  {[
                    { id: "all", label: "All" },
                    { id: "low", label: "Low" },
                    { id: "medium", label: "Medium" },
                    { id: "high", label: "High" }
                  ].map((filter) => (
                    <Button
                      key={filter.id}
                      variant={filterRiskLevel === filter.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterRiskLevel(filter.id)}
                      className={filterRiskLevel === filter.id ? "btn-gradient" : ""}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {filteredAssessments.map((assessment) => {
                const RiskIcon = getRiskIcon(assessment.riskLevel)
                return (
                  <div
                    key={assessment.id}
                    onClick={() => setSelectedAssessment(assessment)}
                    className={cn(
                      "p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedAssessment?.id === assessment.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        getRiskLevelColor(assessment.riskLevel).split(' ')[1]
                      )}>
                        <RiskIcon className={cn(
                          "h-4 w-4",
                          getRiskLevelColor(assessment.riskLevel).split(' ')[0]
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{assessment.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{assessment.policyType}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge className={getRiskLevelColor(assessment.riskLevel)}>
                            {assessment.riskLevel}
                          </Badge>
                          <span className="text-sm font-semibold">{assessment.overallScore}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated {assessment.lastUpdated}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Assessment Details */}
        <div className="lg:col-span-2">
          {selectedAssessment ? (
            <div className="space-y-6">
              {/* Assessment Header */}
              <Card className="professional-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{selectedAssessment.customerName}</h2>
                    <p className="text-muted-foreground">{selectedAssessment.policyType} • {selectedAssessment.id}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-muted-foreground">Overall Risk Score:</span>
                      <span className="text-2xl font-bold text-foreground">{selectedAssessment.overallScore}%</span>
                    </div>
                    <Badge className={getRiskLevelColor(selectedAssessment.riskLevel)}>
                      {selectedAssessment.riskLevel.toUpperCase()} RISK
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-semibold">{selectedAssessment.lastUpdated}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Assessed By</p>
                    <p className="font-semibold">{selectedAssessment.assessedBy}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Risk Factors</p>
                    <p className="font-semibold">{selectedAssessment.factors.length} factors</p>
                  </div>
                </div>
              </Card>

              {/* Risk Factors */}
              <Card className="professional-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Risk Factor Analysis</h3>
                <div className="space-y-4">
                  {selectedAssessment.factors.map((factor) => (
                    <div key={factor.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            getRiskLevelColor(factor.status).split(' ')[1]
                          )}>
                            <Shield className={cn(
                              "h-4 w-4",
                              getRiskLevelColor(factor.status).split(' ')[0]
                            )} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">{factor.name}</h4>
                            <p className="text-sm text-muted-foreground">{factor.category} • Weight: {factor.weight}%</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-foreground">{factor.score}%</span>
                          <Badge className={cn("ml-2", getRiskLevelColor(factor.status))}>
                            {factor.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full",
                              factor.score >= 80 ? "bg-green-500" :
                              factor.score >= 60 ? "bg-yellow-500" :
                              factor.score >= 40 ? "bg-orange-500" : "bg-red-500"
                            )}
                            style={{ width: `${factor.score}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">{factor.description}</p>

                      <div>
                        <p className="text-sm font-medium text-foreground mb-2">Recommendations:</p>
                        <ul className="space-y-1">
                          {factor.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start space-x-2 text-sm">
                              <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Actions */}
              <Card className="professional-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reassess Risk
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                  <Button className="btn-gradient w-full">
                    <Shield className="h-4 w-4 mr-2" />
                    Update Assessment
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="professional-card p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Select a Risk Assessment</h3>
                <p className="text-muted-foreground">Choose an assessment from the list to view detailed analysis</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}