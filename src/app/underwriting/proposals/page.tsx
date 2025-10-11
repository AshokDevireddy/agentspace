"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  FileText,
  Send,
  Download,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  Shield,
  ArrowLeft,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Mail,
  Phone
} from "lucide-react"

interface PolicyProposal {
  id: string
  customerName: string
  customerEmail: string
  customerPhone: string
  policyType: string
  coverage: number
  premium: number
  deductible: number
  status: 'draft' | 'sent' | 'under-review' | 'approved' | 'declined' | 'expired'
  createdDate: string
  sentDate?: string
  expirationDate: string
  lastActivity: string
  agent: string
  riskScore: number
  documents: Array<{
    name: string
    type: string
    size: string
  }>
  notes?: string
}

const mockProposals: PolicyProposal[] = [
  {
    id: "PROP-2024-001",
    customerName: "John Anderson",
    customerEmail: "john.anderson@email.com",
    customerPhone: "(555) 123-4567",
    policyType: "Term Life Insurance",
    coverage: 500000,
    premium: 85.50,
    deductible: 0,
    status: "sent",
    createdDate: "2024-01-15",
    sentDate: "2024-01-16",
    expirationDate: "2024-02-15",
    lastActivity: "2024-01-18",
    agent: "Sarah Johnson",
    riskScore: 75,
    documents: [
      { name: "Policy Proposal.pdf", type: "PDF", size: "2.3 MB" },
      { name: "Terms & Conditions.pdf", type: "PDF", size: "1.8 MB" }
    ],
    notes: "Customer expressed interest in additional coverage options"
  },
  {
    id: "PROP-2024-002",
    customerName: "Emily Rodriguez",
    customerEmail: "emily.rodriguez@email.com",
    customerPhone: "(555) 234-5678",
    policyType: "Auto Insurance",
    coverage: 100000,
    premium: 156.25,
    deductible: 500,
    status: "approved",
    createdDate: "2024-01-14",
    sentDate: "2024-01-15",
    expirationDate: "2024-02-14",
    lastActivity: "2024-01-17",
    agent: "Michael Chen",
    riskScore: 85,
    documents: [
      { name: "Auto Policy Proposal.pdf", type: "PDF", size: "1.9 MB" },
      { name: "Coverage Details.pdf", type: "PDF", size: "1.2 MB" },
      { name: "Signed Application.pdf", type: "PDF", size: "3.1 MB" }
    ]
  },
  {
    id: "PROP-2024-003",
    customerName: "David Thompson",
    customerEmail: "david.thompson@email.com",
    customerPhone: "(555) 345-6789",
    policyType: "Home Insurance",
    coverage: 750000,
    premium: 245.00,
    deductible: 1000,
    status: "under-review",
    createdDate: "2024-01-13",
    sentDate: "2024-01-14",
    expirationDate: "2024-02-13",
    lastActivity: "2024-01-16",
    agent: "Lisa Parker",
    riskScore: 65,
    documents: [
      { name: "Home Policy Proposal.pdf", type: "PDF", size: "2.7 MB" },
      { name: "Property Inspection.pdf", type: "PDF", size: "4.2 MB" }
    ],
    notes: "Waiting for additional property documentation"
  },
  {
    id: "PROP-2024-004",
    customerName: "Sarah Williams",
    customerEmail: "sarah.williams@email.com",
    customerPhone: "(555) 456-7890",
    policyType: "Disability Insurance",
    coverage: 2500,
    premium: 125.75,
    deductible: 0,
    status: "draft",
    createdDate: "2024-01-12",
    expirationDate: "2024-02-12",
    lastActivity: "2024-01-15",
    agent: "James Wilson",
    riskScore: 80,
    documents: [
      { name: "Draft Proposal.pdf", type: "PDF", size: "1.5 MB" }
    ]
  },
  {
    id: "PROP-2024-005",
    customerName: "Michael Foster",
    customerEmail: "michael.foster@email.com",
    customerPhone: "(555) 567-8901",
    policyType: "Whole Life Insurance",
    coverage: 1000000,
    premium: 350.00,
    deductible: 0,
    status: "expired",
    createdDate: "2024-01-10",
    sentDate: "2024-01-11",
    expirationDate: "2024-01-25",
    lastActivity: "2024-01-11",
    agent: "Sarah Johnson",
    riskScore: 70,
    documents: [
      { name: "Life Policy Proposal.pdf", type: "PDF", size: "2.1 MB" }
    ],
    notes: "Customer did not respond within the proposal period"
  }
]

export default function ProposalsPage() {
  const [selectedProposal, setSelectedProposal] = useState<PolicyProposal | null>(mockProposals[0])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  const filteredProposals = mockProposals.filter(proposal => {
    const matchesSearch = proposal.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         proposal.policyType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         proposal.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === "all" || proposal.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "text-gray-500 bg-gray-500/20"
      case "sent": return "text-blue-500 bg-blue-500/20"
      case "under-review": return "text-yellow-500 bg-yellow-500/20"
      case "approved": return "text-green-500 bg-green-500/20"
      case "declined": return "text-red-500 bg-red-500/20"
      case "expired": return "text-orange-500 bg-orange-500/20"
      default: return "text-muted-foreground bg-muted"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft": return Edit
      case "sent": return Send
      case "under-review": return Clock
      case "approved": return CheckCircle
      case "declined": return XCircle
      case "expired": return AlertTriangle
      default: return FileText
    }
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

  const statusStats = {
    draft: mockProposals.filter(p => p.status === "draft").length,
    sent: mockProposals.filter(p => p.status === "sent").length,
    approved: mockProposals.filter(p => p.status === "approved").length,
    pending: mockProposals.filter(p => p.status === "under-review").length
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
            <h1 className="text-3xl font-bold text-gradient">Policy Proposals</h1>
            <p className="text-muted-foreground mt-1">Manage and track all policy proposals</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/underwriting/quote">
            <Button className="btn-gradient">
              <Plus className="h-4 w-4 mr-2" />
              New Proposal
            </Button>
          </Link>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <Edit className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-2xl font-bold text-foreground">{statusStats.draft}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Send className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sent</p>
              <p className="text-2xl font-bold text-foreground">{statusStats.sent}</p>
            </div>
          </div>
        </Card>

        <Card className="professional-card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Under Review</p>
              <p className="text-2xl font-bold text-foreground">{statusStats.pending}</p>
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
              <p className="text-2xl font-bold text-foreground">{statusStats.approved}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Proposals List */}
        <div className="lg:col-span-1">
          <Card className="professional-card">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Proposals</h2>
                <Badge variant="outline">{filteredProposals.length} proposals</Badge>
              </div>

              {/* Search and Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search proposals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex space-x-2 overflow-x-auto">
                  {[
                    { id: "all", label: "All" },
                    { id: "draft", label: "Draft" },
                    { id: "sent", label: "Sent" },
                    { id: "approved", label: "Approved" }
                  ].map((filter) => (
                    <Button
                      key={filter.id}
                      variant={filterStatus === filter.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterStatus(filter.id)}
                      className={cn(
                        "whitespace-nowrap",
                        filterStatus === filter.id ? "btn-gradient" : ""
                      )}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {filteredProposals.map((proposal) => {
                const StatusIcon = getStatusIcon(proposal.status)
                return (
                  <div
                    key={proposal.id}
                    onClick={() => setSelectedProposal(proposal)}
                    className={cn(
                      "p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedProposal?.id === proposal.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        getStatusColor(proposal.status).split(' ')[1]
                      )}>
                        <StatusIcon className={cn(
                          "h-4 w-4",
                          getStatusColor(proposal.status).split(' ')[0]
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{proposal.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{proposal.policyType}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge className={getStatusColor(proposal.status)}>
                            {proposal.status.replace("-", " ")}
                          </Badge>
                          <span className="text-sm font-semibold">{formatCurrency(proposal.premium)}/mo</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {proposal.id}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Proposal Details */}
        <div className="lg:col-span-2">
          {selectedProposal ? (
            <div className="space-y-6">
              {/* Proposal Header */}
              <Card className="professional-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{selectedProposal.customerName}</h2>
                    <p className="text-muted-foreground">{selectedProposal.policyType} • {selectedProposal.id}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(selectedProposal.status)}>
                      {selectedProposal.status.replace("-", " ").toUpperCase()}
                    </Badge>
                    <Button size="sm" variant="ghost">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Coverage Amount</p>
                      <p className="font-semibold text-lg">{formatCurrency(selectedProposal.coverage)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Premium</p>
                      <p className="font-semibold text-lg text-primary">{formatCurrency(selectedProposal.premium)}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Deductible</p>
                      <p className="font-semibold">{selectedProposal.deductible > 0 ? formatCurrency(selectedProposal.deductible) : "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Score</p>
                      <p className={cn(
                        "font-semibold",
                        selectedProposal.riskScore >= 80 ? "text-green-500" :
                        selectedProposal.riskScore >= 60 ? "text-yellow-500" : "text-red-500"
                      )}>
                        {selectedProposal.riskScore}%
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Expiration</p>
                      <p className="font-semibold">{selectedProposal.expirationDate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Agent</p>
                      <p className="font-semibold">{selectedProposal.agent}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Customer Info */}
              <Card className="professional-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Full Name</p>
                        <p className="font-medium">{selectedProposal.customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedProposal.customerEmail}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedProposal.customerPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last Activity</p>
                        <p className="font-medium">{selectedProposal.lastActivity}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Documents */}
              <Card className="professional-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Documents</h3>
                <div className="space-y-3">
                  {selectedProposal.documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/20 rounded-lg">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{doc.type} • {doc.size}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Notes */}
              {selectedProposal.notes && (
                <Card className="professional-card p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Notes</h3>
                  <p className="text-muted-foreground">{selectedProposal.notes}</p>
                </Card>
              )}

              {/* Actions */}
              <Card className="professional-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Button variant="outline" className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                  <Button className="btn-gradient w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="professional-card p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Select a Proposal</h3>
                <p className="text-muted-foreground">Choose a proposal from the list to view its details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}