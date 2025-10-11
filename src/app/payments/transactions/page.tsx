"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Checkbox } from "@/components/ui/checkbox"

// Dummy carrier transactions data
const carrierTransactions = [
  {
    id: "1",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC6985093",
    client: "",
    type: "Chargeback",
    amount: "-$616.90",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "2",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC6988603",
    client: "",
    type: "Chargeback",
    amount: "-$234.36",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "—",
    leadSourceDetail: "",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "3",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC6992695",
    client: "",
    type: "Chargeback",
    amount: "-$1,101.63",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "—",
    leadSourceDetail: "",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "4",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7002117",
    client: "",
    type: "Chargeback",
    amount: "-$1,202.04",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "5",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7002783",
    client: "",
    type: "Chargeback",
    amount: "-$717.66",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "6",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7002823",
    client: "",
    type: "Chargeback",
    amount: "-$636.88",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "—",
    leadSourceDetail: "",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "7",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7003716",
    client: "",
    type: "Chargeback",
    amount: "-$771.75",
    splitPercent: "0.0%",
    splitAgent: "None",
    leadSource: "Referral",
    leadSourceDetail: "Rosemary's Daughter",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "8",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7003811",
    client: "",
    type: "Chargeback",
    amount: "-$444.08",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "9",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7004078",
    client: "",
    type: "Chargeback",
    amount: "-$229.13",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "10",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7004738",
    client: "",
    type: "Chargeback",
    amount: "-$237.72",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "11",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7005779",
    client: "",
    type: "Chargeback",
    amount: "-$565.95",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "—",
    leadSourceDetail: "",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "12",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7008048",
    client: "",
    type: "Chargeback",
    amount: "-$706.65",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  },
  {
    id: "13",
    date: "05/24/2025",
    carrier: "Aetna",
    agent: "None",
    policy: "ACC7009288",
    client: "",
    type: "Chargeback",
    amount: "-$810.32",
    splitPercent: "50.00%",
    splitAgent: "Schwartz, Joseph",
    leadSource: "Provided",
    leadSourceDetail: "Karma Financial",
    source: "Aetna_5.21debt.xlsx",
    paymentId: "AV029",
    approved: true
  }
]

// Options for dropdowns
const carrierOptions = [
  { value: "all", label: "Select a Carrier" },
  { value: "Aetna", label: "Aetna" },
  { value: "Aflac", label: "Aflac" },
  { value: "American Amicable", label: "American Amicable / Occidental" },
  { value: "Foresters Financial", label: "Foresters Financial" },
  { value: "Guarantee Trust Life", label: "Guarantee Trust Life (GTL)" }
]

const agentOptions = [
  { value: "all", label: "Select an Agent" },
  { value: "Schwartz, Joseph", label: "Schwartz, Joseph" },
  { value: "Phillips, Adam", label: "Phillips, Adam" },
  { value: "Perichitch, Milutin", label: "Perichitch, Milutin" },
  { value: "None", label: "None" }
]

const policyOptions = [
  { value: "all", label: "Select a Policy" },
  { value: "ACC6985093", label: "ACC6985093" },
  { value: "ACC6988603", label: "ACC6988603" },
  { value: "ACC6992695", label: "ACC6992695" },
  { value: "ACC7002117", label: "ACC7002117" }
]

const typeOptions = [
  { value: "all", label: "Select a Transaction Type" },
  { value: "Chargeback", label: "Chargeback" },
  { value: "Commission", label: "Commission" },
  { value: "Bonus", label: "Bonus" },
  { value: "Override", label: "Override" }
]

const leadSourceOptions = [
  { value: "all", label: "--------" },
  { value: "Provided", label: "Provided" },
  { value: "Purchased", label: "Purchased" },
  { value: "Referral", label: "Referral" },
  { value: "No Lead", label: "No Lead" }
]

const notApprovedOptions = [
  { value: "all", label: "--------" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" }
]

const leadSourceColors = {
  "Provided": "bg-blue-100 text-blue-800",
  "Purchased": "bg-purple-100 text-purple-800",
  "Referral": "bg-green-100 text-green-800",
  "—": "bg-gray-100 text-gray-800"
}

export default function CarrierTransactions() {
  const [selectedCarrier, setSelectedCarrier] = useState("all")
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedPolicy, setSelectedPolicy] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedLeadSource, setSelectedLeadSource] = useState("all")
  const [selectedNotApproved, setSelectedNotApproved] = useState("all")
  const [negativeOnly, setNegativeOnly] = useState(false)

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gradient">Carrier Transactions</h1>
        <Button className="btn-gradient" size="sm">
          Upload Commission Report
        </Button>
      </div>

      {/* Filters */}
      <Card className="professional-card filter-container">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* First Row - Primary Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Carrier
                </label>
                <SimpleSearchableSelect
                  options={carrierOptions}
                  value={selectedCarrier}
                  onValueChange={setSelectedCarrier}
                  placeholder="Select a Carrier"
                  searchPlaceholder="Search carriers..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Agent
                </label>
                <SimpleSearchableSelect
                  options={agentOptions}
                  value={selectedAgent}
                  onValueChange={setSelectedAgent}
                  placeholder="Select an Agent"
                  searchPlaceholder="Search agents..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Policy
                </label>
                <SimpleSearchableSelect
                  options={policyOptions}
                  value={selectedPolicy}
                  onValueChange={setSelectedPolicy}
                  placeholder="Select a Policy"
                  searchPlaceholder="Search policies..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Type
                </label>
                <SimpleSearchableSelect
                  options={typeOptions}
                  value={selectedType}
                  onValueChange={setSelectedType}
                  placeholder="Select a Transaction Type"
                  searchPlaceholder="Search types..."
                />
              </div>
            </div>

            {/* Second Row - Additional Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Lead Source
                </label>
                <SimpleSearchableSelect
                  options={leadSourceOptions}
                  value={selectedLeadSource}
                  onValueChange={setSelectedLeadSource}
                  placeholder="--------"
                  searchPlaceholder="Search lead sources..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Not Approved
                </label>
                <SimpleSearchableSelect
                  options={notApprovedOptions}
                  value={selectedNotApproved}
                  onValueChange={setSelectedNotApproved}
                  placeholder="--------"
                  searchPlaceholder="Search..."
                />
              </div>

              <div className="flex items-center space-x-2 mt-6">
                <Checkbox
                  id="negativeOnly"
                  checked={negativeOnly}
                  onCheckedChange={setNegativeOnly}
                />
                <label htmlFor="negativeOnly" className="text-sm font-medium text-muted-foreground">
                  Negative Only
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="professional-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Carrier</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Policy</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Type</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Split %</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Split Agent</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Lead Source</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Source</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Payment ID</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Approved</th>
                </tr>
              </thead>
              <tbody>
                {carrierTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                    <td className="py-4 px-6 text-foreground">{transaction.date}</td>
                    <td className="py-4 px-6 text-foreground">{transaction.carrier}</td>
                    <td className="py-4 px-6 text-foreground">{transaction.agent}</td>
                    <td className="py-4 px-6">
                      <a href="#" className="text-primary hover:text-primary/80 underline">
                        {transaction.policy}
                      </a>
                    </td>
                    <td className="py-4 px-6 text-foreground">{transaction.client}</td>
                    <td className="py-4 px-6 text-foreground">{transaction.type}</td>
                    <td className={`py-4 px-6 text-right font-medium ${
                      transaction.amount.startsWith('-') ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {transaction.amount}
                    </td>
                    <td className="py-4 px-6 text-center text-foreground">{transaction.splitPercent}</td>
                    <td className="py-4 px-6 text-foreground">{transaction.splitAgent}</td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        <Badge
                          className={`${leadSourceColors[transaction.leadSource as keyof typeof leadSourceColors]} border-0`}
                          variant="outline"
                        >
                          {transaction.leadSource}
                        </Badge>
                        {transaction.leadSourceDetail && (
                          <span className="text-xs text-muted-foreground">{transaction.leadSourceDetail}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <a href="#" className="text-primary hover:text-primary/80 underline text-xs">
                        {transaction.source}
                      </a>
                    </td>
                    <td className="py-4 px-6 text-foreground">{transaction.paymentId}</td>
                    <td className="py-4 px-6 text-center">
                      <Button
                        className="btn-gradient h-6 px-3 text-xs"
                        size="sm"
                      >
                        ☑
                      </Button>
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