"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import { Edit, Trash2 } from "lucide-react"

// Dummy drafts data matching the uploaded image
const draftsData = [
  {
    id: "1",
    date: "5/24/25",
    agent: "Trudeau, Jackson",
    carrier: "American Amicable / Occidental",
    product: "Clear Choice 0-79",
    appNumber: "002559334",
    client: "Julie Grey",
    splitPercent: "50.00%",
    splitWith: "Schwartz, Joseph",
    annualPremium: "$659.52",
    leadSource: "Provided",
    leadSourceType: "Karma Financial"
  },
  {
    id: "2",
    date: "5/24/25",
    agent: "Ward, Lucas",
    carrier: "Guarantee Trust Life (GTL)",
    product: "Heritage FEX (Age 40-79)",
    appNumber: "",
    client: "Kimberly Murphy",
    splitPercent: "0.00%",
    splitWith: "None",
    annualPremium: "$933.96",
    leadSource: "—",
    leadSourceType: ""
  },
  {
    id: "3",
    date: "5/24/25",
    agent: "Lual, Ruot",
    carrier: "Aflac",
    product: "Final Expense (Level)",
    appNumber: "0",
    client: "Bichok Kier",
    splitPercent: "0.00%",
    splitWith: "None",
    annualPremium: "$305.52",
    leadSource: "Purchased",
    leadSourceType: "Family"
  },
  {
    id: "4",
    date: "5/24/25",
    agent: "Neumann, Ethan",
    carrier: "Aflac",
    product: "Final Expense (Level)",
    appNumber: "TER639001",
    client: "Margaret beard",
    splitPercent: "0.00%",
    splitWith: "None",
    annualPremium: "$620.28",
    leadSource: "Purchased",
    leadSourceType: "friends lead"
  },
  {
    id: "5",
    date: "5/24/25",
    agent: "Shadic, Gael",
    carrier: "American Amicable / Occidental",
    product: "Easy Term",
    appNumber: "",
    client: "Patricia Cunningham",
    splitPercent: "50.00%",
    splitWith: "Schwartz, Joseph",
    annualPremium: "$865.20",
    leadSource: "Provided",
    leadSourceType: "Karma Financial"
  },
  {
    id: "6",
    date: "5/24/25",
    agent: "Trudeau, Jackson",
    carrier: "Aetna",
    product: "Accendo (Modified)",
    appNumber: "ACC7044782",
    client: "Tamica Cooper",
    splitPercent: "50.00%",
    splitWith: "Schwartz, Joseph",
    annualPremium: "$646.80",
    leadSource: "Provided",
    leadSourceType: "Karma Financial"
  },
  {
    id: "7",
    date: "5/24/25",
    agent: "Vuola, Nick",
    carrier: "Guarantee Trust Life (GTL)",
    product: "Heritage FEX (Age 40-79)",
    appNumber: "",
    client: "Anissa Lombardo",
    splitPercent: "0.00%",
    splitWith: "None",
    annualPremium: "$594.00",
    leadSource: "Purchased",
    leadSourceType: "Team beast full comp"
  },
  {
    id: "8",
    date: "5/24/25",
    agent: "Macnaughton, Luke",
    carrier: "Aetna",
    product: "Accendo (Preferred/Standard)",
    appNumber: "",
    client: "Gerry Young",
    splitPercent: "0.00%",
    splitWith: "None",
    annualPremium: "$2,083.20",
    leadSource: "Purchased",
    leadSourceType: "purchased vet lead"
  },
  {
    id: "9",
    date: "5/24/25",
    agent: "Gomez, Cesar",
    carrier: "American Amicable / Occidental",
    product: "Clear Choice 0-79",
    appNumber: "",
    client: "Marcelina Pereyra",
    splitPercent: "50.00%",
    splitWith: "Schwartz, Joseph",
    annualPremium: "$374.64",
    leadSource: "Provided",
    leadSourceType: "Karma Financial"
  },
  {
    id: "10",
    date: "5/24/25",
    agent: "Gomez, Cesar",
    carrier: "American Amicable / Occidental",
    product: "Clear Choice 0-79",
    appNumber: "",
    client: "Marcelina Pereyra",
    splitPercent: "50.00%",
    splitWith: "Schwartz, Joseph",
    annualPremium: "$831.96",
    leadSource: "Provided",
    leadSourceType: "Karma Financial"
  },
  {
    id: "11",
    date: "5/24/25",
    agent: "Fnu, Musa",
    carrier: "Aflac",
    product: "Final Expense (Level)",
    appNumber: "",
    client: "Gabriel D. GhaskinHurd",
    splitPercent: "50.00%",
    splitWith: "Schwartz, Joseph",
    annualPremium: "$1,387.80",
    leadSource: "Provided",
    leadSourceType: "Karma Financial"
  }
]

const leadSourceColors = {
  "Provided": "bg-blue-100 text-blue-800",
  "Purchased": "bg-purple-100 text-purple-800",
  "Referral": "bg-green-100 text-green-800",
  "—": "bg-gray-100 text-gray-800"
}

// Options for dropdowns
const agentOptions = [
  { value: "all", label: "Select an Agent" },
  { value: "Trudeau, Jackson", label: "Trudeau, Jackson" },
  { value: "Ward, Lucas", label: "Ward, Lucas" },
  { value: "Lual, Ruot", label: "Lual, Ruot" },
  { value: "Neumann, Ethan", label: "Neumann, Ethan" },
  { value: "Shadic, Gael", label: "Shadic, Gael" },
  { value: "Vuola, Nick", label: "Vuola, Nick" },
  { value: "Macnaughton, Luke", label: "Macnaughton, Luke" },
  { value: "Gomez, Cesar", label: "Gomez, Cesar" },
  { value: "Fnu, Musa", label: "Fnu, Musa" }
]

const carrierOptions = [
  { value: "all", label: "Select a Carrier" },
  { value: "American Amicable", label: "American Amicable / Occidental" },
  { value: "Guarantee Trust Life", label: "Guarantee Trust Life (GTL)" },
  { value: "Aflac", label: "Aflac" },
  { value: "Aetna", label: "Aetna" }
]

const productOptions = [
  { value: "all", label: "Select a Product" },
  { value: "Clear Choice 0-79", label: "Clear Choice 0-79" },
  { value: "Heritage FEX", label: "Heritage FEX (Age 40-79)" },
  { value: "Final Expense", label: "Final Expense (Level)" },
  { value: "Accendo", label: "Accendo (Modified)" },
  { value: "Easy Term", label: "Easy Term" }
]

const splitWithOptions = [
  { value: "all", label: "Select an Agent" },
  { value: "Schwartz, Joseph", label: "Schwartz, Joseph" },
  { value: "None", label: "None" }
]

const leadSourceOptions = [
  { value: "all", label: "--------" },
  { value: "Referral", label: "Referral" },
  { value: "Purchased", label: "Purchased Lead" },
  { value: "Provided", label: "Provided Lead" },
  { value: "No Lead", label: "No Lead" }
]

export default function PolicyDrafts() {
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [selectedCarrier, setSelectedCarrier] = useState("all")
  const [selectedProduct, setSelectedProduct] = useState("all")
  const [clientSearch, setClientSearch] = useState("")
  const [appNumberSearch, setAppNumberSearch] = useState("")
  const [selectedSplitWith, setSelectedSplitWith] = useState("all")
  const [selectedLeadSource, setSelectedLeadSource] = useState("all")

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gradient">Drafts</h1>
      </div>

      {/* Filters */}
      <Card className="professional-card filter-container">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* First Row - Primary Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Agent
                </label>
                <SimpleSearchableSelect
                  value={selectedAgent}
                  onValueChange={setSelectedAgent}
                  options={agentOptions}
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
                  placeholder="Select a Carrier"
                  searchPlaceholder="Search carriers..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Product
                </label>
                <SimpleSearchableSelect
                  options={productOptions}
                  value={selectedProduct}
                  onValueChange={setSelectedProduct}
                  placeholder="Select a Product"
                  searchPlaceholder="Search products..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Client
                </label>
                <Input
                  type="text"
                  placeholder="Enter Client's Name"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Second Row - Additional Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Application #
                </label>
                <Input
                  type="text"
                  placeholder="Enter an Application Number"
                  value={appNumberSearch}
                  onChange={(e) => setAppNumberSearch(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Split With
                </label>
                <SimpleSearchableSelect
                  options={splitWithOptions}
                  value={selectedSplitWith}
                  onValueChange={setSelectedSplitWith}
                  placeholder="Select an Agent"
                  searchPlaceholder="Search agents..."
                />
              </div>

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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drafts Table */}
      <Card className="professional-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Carrier</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Product</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">App #</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Client</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Split %</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Split With</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Annual Premium</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Lead Source</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draftsData.map((draft) => (
                  <tr key={draft.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                    <td className="py-4 px-6 text-foreground">{draft.date}</td>
                    <td className="py-4 px-6 text-foreground">{draft.agent}</td>
                    <td className="py-4 px-6 text-foreground">{draft.carrier}</td>
                    <td className="py-4 px-6 text-foreground">{draft.product}</td>
                    <td className="py-4 px-6 text-foreground">{draft.appNumber}</td>
                    <td className="py-4 px-6 text-foreground">{draft.client}</td>
                    <td className="py-4 px-6 text-center text-foreground">{draft.splitPercent}</td>
                    <td className="py-4 px-6 text-foreground">{draft.splitWith}</td>
                    <td className="py-4 px-6 text-right text-foreground">{draft.annualPremium}</td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        <Badge
                          className={`${leadSourceColors[draft.leadSource as keyof typeof leadSourceColors]} border-0`}
                          variant="outline"
                        >
                          {draft.leadSource}
                        </Badge>
                        {draft.leadSourceType && (
                          <span className="text-xs text-muted-foreground">{draft.leadSourceType}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-destructive hover:text-destructive/80 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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