"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import Link from "next/link"

// Dummy transactions data
const transactions = [
  {
    id: "1",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Schwartz, Joseph",
    position: "Legacy Junior Partner",
    policy: "ACC6985093",
    type: "Chargeback",
    commission: "-$616.90",
    totalCommRate: "250.00%",
    commRate: "17.50%",
    transactionAmount: "-$43.18",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "2",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Schwartz, Joseph",
    position: "Legacy Junior Partner",
    policy: "ACC6985093",
    type: "Chargeback",
    commission: "-$616.90",
    totalCommRate: "250.00%",
    commRate: "125.00%",
    transactionAmount: "-$308.45",
    source: "",
    payout: "None"
  },
  {
    id: "3",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Perichitch, Milutin",
    position: "Legacy GA",
    policy: "ACC6985093",
    type: "Chargeback",
    commission: "-$616.90",
    totalCommRate: "250.00%",
    commRate: "37.50%",
    transactionAmount: "-$92.54",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "4",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Ullah, Aqib",
    position: "Prodigy",
    policy: "ACC6985093",
    type: "Chargeback",
    commission: "-$616.90",
    totalCommRate: "250.00%",
    commRate: "70.00%",
    transactionAmount: "-$172.73",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "5",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Schwartz, Joseph",
    position: "Legacy Junior Partner",
    policy: "ACC6988603",
    type: "Chargeback",
    commission: "-$234.36",
    totalCommRate: "250.00%",
    commRate: "125.00%",
    transactionAmount: "-$117.18",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "6",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Schwartz, Joseph",
    position: "Legacy Junior Partner",
    policy: "ACC6988603",
    type: "Chargeback",
    commission: "-$234.36",
    totalCommRate: "250.00%",
    commRate: "17.50%",
    transactionAmount: "-$16.41",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "7",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Zaks, Sontag",
    position: "Legacy GA",
    policy: "ACC6988603",
    type: "Chargeback",
    commission: "-$234.36",
    totalCommRate: "250.00%",
    commRate: "37.50%",
    transactionAmount: "-$35.15",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "8",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Soberanis, Justin",
    position: "Prodigy",
    policy: "ACC6988603",
    type: "Chargeback",
    commission: "-$234.36",
    totalCommRate: "250.00%",
    commRate: "70.00%",
    transactionAmount: "-$65.62",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "9",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Schwartz, Joseph",
    position: "Legacy Junior Partner",
    policy: "ACC6992695",
    type: "Chargeback",
    commission: "-$1,101.63",
    totalCommRate: "250.00%",
    commRate: "17.50%",
    transactionAmount: "-$77.11",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "10",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Schwartz, Joseph",
    position: "Legacy Junior Partner",
    policy: "ACC6992695",
    type: "Chargeback",
    commission: "-$1,101.63",
    totalCommRate: "250.00%",
    commRate: "125.00%",
    transactionAmount: "-$550.82",
    source: "",
    payout: "None"
  },
  {
    id: "11",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Zaks, Sontag",
    position: "Legacy GA",
    policy: "ACC6992695",
    type: "Chargeback",
    commission: "-$1,101.63",
    totalCommRate: "250.00%",
    commRate: "22.50%",
    transactionAmount: "-$99.15",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "12",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Zambrano, Elio",
    position: "Supervising Agent 2",
    policy: "ACC6992695",
    type: "Chargeback",
    commission: "-$1,101.63",
    totalCommRate: "250.00%",
    commRate: "15.00%",
    transactionAmount: "-$66.10",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "13",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Hauser, Landon",
    position: "Prodigy",
    policy: "ACC6992695",
    type: "Chargeback",
    commission: "-$1,101.63",
    totalCommRate: "250.00%",
    commRate: "70.00%",
    transactionAmount: "-$308.46",
    source: "Aetna 2025-05-24",
    payout: "None"
  },
  {
    id: "14",
    date: "May 24, 2025",
    carrier: "Aetna",
    agent: "Schwartz, Joseph",
    position: "Legacy Junior Partner",
    policy: "ACC7002117",
    type: "Chargeback",
    commission: "-$1,202.04",
    totalCommRate: "250.00%",
    commRate: "125.00%",
    transactionAmount: "-$601.02",
    source: "Aetna 2025-05-24",
    payout: "None"
  }
]

// Options for dropdowns
const hasPayoutOptions = [
  { value: "all", label: "--------" },
  { value: "has", label: "Has Payout" },
  { value: "no", label: "No Payout" }
]

const commissionReportOptions = [
  { value: "all", label: "--------" },
  { value: "AV029", label: "AV029" },
  { value: "AV028", label: "AV028" },
  { value: "AV027", label: "AV027" }
]

const agentPayrollOptions = [
  { value: "all", label: "--------" },
  { value: "2025-05-18", label: "2025-05-18" },
  { value: "2025-05-11", label: "2025-05-11" },
  { value: "2025-05-04", label: "2025-05-04" }
]

const agentOptions = [
  { value: "all", label: "Select an Agent" },
  { value: "Schwartz, Joseph", label: "Schwartz, Joseph" },
  { value: "Perichitch, Milutin", label: "Perichitch, Milutin" },
  { value: "Ullah, Aqib", label: "Ullah, Aqib" },
  { value: "Zaks, Sontag", label: "Zaks, Sontag" },
  { value: "Soberanis, Justin", label: "Soberanis, Justin" }
]

const policyOptions = [
  { value: "all", label: "Select a Policy" },
  { value: "ACC6985093", label: "ACC6985093" },
  { value: "ACC6988603", label: "ACC6988603" },
  { value: "ACC6992695", label: "ACC6992695" },
  { value: "ACC7002117", label: "ACC7002117" }
]

const carrierOptions = [
  { value: "all", label: "--------" },
  { value: "Aetna", label: "Aetna" },
  { value: "Aflac", label: "Aflac" },
  { value: "American Amicable", label: "American Amicable / Occidental" },
  { value: "Foresters Financial", label: "Foresters Financial" }
]

export default function AllTransactions() {
  const [selectedHasPayout, setSelectedHasPayout] = useState("all")
  const [selectedCommissionReport, setSelectedCommissionReport] = useState("all")
  const [selectedAgentPayroll, setSelectedAgentPayroll] = useState("all")
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedPolicy, setSelectedPolicy] = useState("all")
  const [selectedCarrier, setSelectedCarrier] = useState("all")

  // Calculate summary statistics
  const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.commission.replace('$', '').replace('-', '').replace(',', '')), 0)
  const commissionPayments = transactions.filter(t => !t.commission.startsWith('-')).length
  const chargebacks = transactions.filter(t => t.commission.startsWith('-')).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold text-gradient">Transactions</h1>
          <Button className="btn-gradient" size="sm">
            Upload Commission Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="professional-card filter-container">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Has Payout / No Payout
              </label>
              <SimpleSearchableSelect
                options={hasPayoutOptions}
                value={selectedHasPayout}
                onValueChange={setSelectedHasPayout}
                placeholder="--------"
                searchPlaceholder="Search..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Commission report
              </label>
              <SimpleSearchableSelect
                options={commissionReportOptions}
                value={selectedCommissionReport}
                onValueChange={setSelectedCommissionReport}
                placeholder="--------"
                searchPlaceholder="Search reports..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Agent payroll
              </label>
              <SimpleSearchableSelect
                options={agentPayrollOptions}
                value={selectedAgentPayroll}
                onValueChange={setSelectedAgentPayroll}
                placeholder="--------"
                searchPlaceholder="Search payrolls..."
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
                Carrier
              </label>
              <SimpleSearchableSelect
                options={carrierOptions}
                value={selectedCarrier}
                onValueChange={setSelectedCarrier}
                placeholder="--------"
                searchPlaceholder="Search carriers..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">Total Amount</h3>
            <p className="text-2xl font-bold text-foreground">$3,003,704.29 (52255)</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">Commission Payments</h3>
            <p className="text-2xl font-bold text-foreground">$3,915,318.96 (42932)</p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">Chargebacks</h3>
            <p className="text-2xl font-bold text-destructive">-$1,018,193.22 (8591)</p>
          </CardContent>
        </Card>
      </div>

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
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Position</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Policy</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Type</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Commission</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Total Comm Rate</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Comm Rate</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Transaction Amount</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Source</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Payout</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                    <td className="py-4 px-6 text-foreground">{transaction.date}</td>
                    <td className="py-4 px-6 text-foreground">{transaction.carrier}</td>
                    <td className="py-4 px-6 text-foreground">{transaction.agent}</td>
                    <td className="py-4 px-6 text-foreground">{transaction.position}</td>
                    <td className="py-4 px-6">
                      <Link
                        href={`/policies/${encodeURIComponent(transaction.carrier)}/${encodeURIComponent(transaction.policy)}`}
                        className="text-primary hover:text-primary/80 underline"
                      >
                        {transaction.policy}
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-foreground">{transaction.type}</td>
                    <td className={`py-4 px-6 text-right font-medium ${
                      transaction.commission.startsWith('-') ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {transaction.commission}
                    </td>
                    <td className="py-4 px-6 text-center text-foreground">{transaction.totalCommRate}</td>
                    <td className="py-4 px-6 text-center text-foreground">{transaction.commRate}</td>
                    <td className={`py-4 px-6 text-right font-medium ${
                      transaction.transactionAmount.startsWith('-') ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {transaction.transactionAmount}
                    </td>
                    <td className="py-4 px-6">
                      {transaction.source && (
                        <Link
                          href="/payments/reports/AV029"
                          className="text-primary hover:text-primary/80 underline text-xs"
                        >
                          {transaction.source}
                        </Link>
                      )}
                    </td>
                    <td className="py-4 px-6 text-foreground">{transaction.payout}</td>
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