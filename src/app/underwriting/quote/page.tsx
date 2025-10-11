"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Calculator,
  User,
  Car,
  Home,
  Heart,
  Shield,
  DollarSign,
  FileText,
  Download,
  Send,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Plus,
  Save,
  RefreshCw
} from "lucide-react"

interface CustomerInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  address: string
  city: string
  state: string
  zipCode: string
  ssn: string
}

interface PolicyDetails {
  type: string
  coverage: string
  deductible: string
  term: string
  additionalCoverage: string[]
}

interface QuoteResult {
  premium: number
  coverage: number
  deductible: number
  term: string
  riskScore: number
  underwritingNotes: string[]
  discounts: Array<{ name: string; amount: number }>
  nextSteps: string[]
}

const policyTypes = [
  { id: "auto", name: "Auto Insurance", icon: Car, description: "Comprehensive vehicle protection" },
  { id: "home", name: "Home Insurance", icon: Home, description: "Property and liability coverage" },
  { id: "life", name: "Life Insurance", icon: Heart, description: "Financial protection for family" },
  { id: "health", name: "Health Insurance", icon: Shield, description: "Medical expense coverage" },
]

const coverageAmounts = {
  auto: ["$25,000", "$50,000", "$100,000", "$250,000", "$500,000"],
  home: ["$200,000", "$300,000", "$500,000", "$750,000", "$1,000,000"],
  life: ["$100,000", "$250,000", "$500,000", "$750,000", "$1,000,000"],
  health: ["$2,500", "$5,000", "$7,500", "$10,000", "$15,000"]
}

const deductibles = {
  auto: ["$250", "$500", "$1,000", "$2,500"],
  home: ["$500", "$1,000", "$2,500", "$5,000"],
  life: ["N/A"],
  health: ["$500", "$1,000", "$2,500", "$5,000"]
}

export default function QuoteEnginePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedPolicyType, setSelectedPolicyType] = useState("")
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    ssn: ""
  })
  const [policyDetails, setPolicyDetails] = useState<PolicyDetails>({
    type: "",
    coverage: "",
    deductible: "",
    term: "",
    additionalCoverage: []
  })
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const steps = [
    { number: 1, title: "Policy Type", description: "Select insurance type" },
    { number: 2, title: "Customer Info", description: "Personal details" },
    { number: 3, title: "Policy Details", description: "Coverage options" },
    { number: 4, title: "Quote Results", description: "Generated quote" }
  ]

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleGenerateQuote = async () => {
    setIsGenerating(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock quote calculation
    const basePremium = Math.random() * 200 + 50
    const riskScore = Math.floor(Math.random() * 40 + 60)

    const mockResult: QuoteResult = {
      premium: Math.round(basePremium * 100) / 100,
      coverage: parseInt(policyDetails.coverage.replace(/[$,]/g, "")),
      deductible: parseInt(policyDetails.deductible.replace(/[$,]/g, "")) || 0,
      term: policyDetails.term || "12 months",
      riskScore,
      underwritingNotes: [
        "Good credit score detected",
        "No previous claims history",
        "Standard risk category",
        "Eligible for safe driver discount"
      ],
      discounts: [
        { name: "Multi-policy discount", amount: 15 },
        { name: "Safe driver discount", amount: 10 },
        { name: "Online quote discount", amount: 5 }
      ],
      nextSteps: [
        "Review policy details and terms",
        "Complete medical questionnaire (if applicable)",
        "Upload required documents",
        "Schedule final underwriting review",
        "Sign policy documents"
      ]
    }

    setQuoteResult(mockResult)
    setIsGenerating(false)
    setCurrentStep(4)
  }

  const handleCustomerInfoChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }))
  }

  const handlePolicyDetailsChange = (field: keyof PolicyDetails, value: string | string[]) => {
    setPolicyDetails(prev => ({ ...prev, [field]: value }))
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return selectedPolicyType !== ""
      case 2:
        return customerInfo.firstName && customerInfo.lastName && customerInfo.email && customerInfo.phone
      case 3:
        return policyDetails.coverage && policyDetails.deductible
      default:
        return true
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
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
            <h1 className="text-3xl font-bold text-gradient">Quote Engine</h1>
            <p className="text-muted-foreground mt-1">Generate instant insurance quotes</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <Card className="professional-card p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-semibold",
                  currentStep >= step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {currentStep > step.number ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <div>
                  <h3 className={cn(
                    "font-medium",
                    currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  "h-0.5 w-24 mx-6",
                  currentStep > step.number ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {currentStep === 1 && (
            <Card className="professional-card p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Select Policy Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {policyTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <div
                      key={type.id}
                      onClick={() => {
                        setSelectedPolicyType(type.id)
                        setPolicyDetails(prev => ({ ...prev, type: type.id }))
                      }}
                      className={cn(
                        "p-6 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md",
                        selectedPolicyType === type.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={cn(
                          "p-3 rounded-lg",
                          selectedPolicyType === type.id ? "bg-primary/20" : "bg-muted"
                        )}>
                          <Icon className={cn(
                            "h-6 w-6",
                            selectedPolicyType === type.id ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{type.name}</h3>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="professional-card p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Customer Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">First Name</label>
                  <Input
                    value={customerInfo.firstName}
                    onChange={(e) => handleCustomerInfoChange("firstName", e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Last Name</label>
                  <Input
                    value={customerInfo.lastName}
                    onChange={(e) => handleCustomerInfoChange("lastName", e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                  <Input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => handleCustomerInfoChange("email", e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                  <Input
                    value={customerInfo.phone}
                    onChange={(e) => handleCustomerInfoChange("phone", e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Date of Birth</label>
                  <Input
                    type="date"
                    value={customerInfo.dateOfBirth}
                    onChange={(e) => handleCustomerInfoChange("dateOfBirth", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">ZIP Code</label>
                  <Input
                    value={customerInfo.zipCode}
                    onChange={(e) => handleCustomerInfoChange("zipCode", e.target.value)}
                    placeholder="Enter ZIP code"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">Address</label>
                  <Input
                    value={customerInfo.address}
                    onChange={(e) => handleCustomerInfoChange("address", e.target.value)}
                    placeholder="Enter street address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">City</label>
                  <Input
                    value={customerInfo.city}
                    onChange={(e) => handleCustomerInfoChange("city", e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">State</label>
                  <select
                    value={customerInfo.state}
                    onChange={(e) => handleCustomerInfoChange("state", e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  >
                    <option value="">Select State</option>
                    <option value="CA">California</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                    {/* Add more states as needed */}
                  </select>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="professional-card p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Policy Details</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Coverage Amount</label>
                    <select
                      value={policyDetails.coverage}
                      onChange={(e) => handlePolicyDetailsChange("coverage", e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    >
                      <option value="">Select Coverage</option>
                      {coverageAmounts[selectedPolicyType as keyof typeof coverageAmounts]?.map((amount) => (
                        <option key={amount} value={amount}>{amount}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Deductible</label>
                    <select
                      value={policyDetails.deductible}
                      onChange={(e) => handlePolicyDetailsChange("deductible", e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    >
                      <option value="">Select Deductible</option>
                      {deductibles[selectedPolicyType as keyof typeof deductibles]?.map((amount) => (
                        <option key={amount} value={amount}>{amount}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Policy Term</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {["6 months", "12 months", "24 months"].map((term) => (
                      <button
                        key={term}
                        onClick={() => handlePolicyDetailsChange("term", term)}
                        className={cn(
                          "p-3 border rounded-lg text-center transition-colors",
                          policyDetails.term === term
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPolicyType === "auto" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Additional Coverage</label>
                    <div className="space-y-2">
                      {["Roadside Assistance", "Rental Car Coverage", "Gap Coverage"].map((coverage) => (
                        <label key={coverage} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            onChange={(e) => {
                              const current = policyDetails.additionalCoverage || []
                              if (e.target.checked) {
                                handlePolicyDetailsChange("additionalCoverage", [...current, coverage])
                              } else {
                                handlePolicyDetailsChange("additionalCoverage", current.filter(c => c !== coverage))
                              }
                            }}
                          />
                          <span className="text-sm text-foreground">{coverage}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {currentStep === 4 && quoteResult && (
            <Card className="professional-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Quote Results</h2>
                <Badge className="bg-green-500/20 text-green-500">
                  Quote Generated Successfully
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Monthly Premium</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(quoteResult.premium)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <span className="text-sm text-muted-foreground block">Coverage</span>
                      <span className="font-semibold">{formatCurrency(quoteResult.coverage)}</span>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <span className="text-sm text-muted-foreground block">Deductible</span>
                      <span className="font-semibold">{formatCurrency(quoteResult.deductible)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Risk Score</span>
                      <Badge className={cn(
                        quoteResult.riskScore >= 80 ? "bg-green-500/20 text-green-500" :
                        quoteResult.riskScore >= 60 ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-red-500/20 text-red-500"
                      )}>
                        {quoteResult.riskScore}% Safe
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${quoteResult.riskScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <span className="text-sm text-muted-foreground block mb-2">Applied Discounts</span>
                    {quoteResult.discounts.map((discount, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{discount.name}</span>
                        <span className="text-green-500">-{discount.amount}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Underwriting Notes</h3>
                  <ul className="space-y-2">
                    {quoteResult.underwritingNotes.map((note, index) => (
                      <li key={index} className="flex items-center space-x-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-3">Next Steps</h3>
                  <ol className="space-y-2">
                    {quoteResult.nextSteps.map((step, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <div className="flex space-x-3">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline">
                    <Send className="h-4 w-4 mr-2" />
                    Email Quote
                  </Button>
                </div>
                <Button className="btn-gradient">
                  <FileText className="h-4 w-4 mr-2" />
                  Convert to Policy
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="professional-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Quote Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Policy Type:</span>
                <span className="font-medium">{selectedPolicyType || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">
                  {customerInfo.firstName && customerInfo.lastName
                    ? `${customerInfo.firstName} ${customerInfo.lastName}`
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Coverage:</span>
                <span className="font-medium">{policyDetails.coverage || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Deductible:</span>
                <span className="font-medium">{policyDetails.deductible || "-"}</span>
              </div>
            </div>
          </Card>

          <Card className="professional-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button variant="outline" size="sm" className="w-full">
                <User className="h-4 w-4 mr-2" />
                Search Existing Customer
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Load Previous Quote
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                <Calculator className="h-4 w-4 mr-2" />
                Rate Calculator
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevStep}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex space-x-3">
          {currentStep === 3 && (
            <Button
              onClick={handleGenerateQuote}
              disabled={!isStepValid(currentStep) || isGenerating}
              className="btn-gradient"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Generate Quote
                </>
              )}
            </Button>
          )}

          {currentStep < 3 && (
            <Button
              onClick={handleNextStep}
              disabled={!isStepValid(currentStep)}
              className="btn-gradient"
            >
              Next
              <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}