"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Edit, Trash2 } from "lucide-react"

// Dummy agent payrolls data matching the uploaded image
const agentPayrolls = [
  {
    id: "1",
    identifier: "",
    date: "May 18, 2025",
    carryForwardIn: "-$203,955.79",
    totalAmount: "-$105,499.10",
    reportTotal: "$92,756.25",
    totalPaid: "$108,443.51",
    totalNet: "-$15,687.26",
    carryForwardOut: "-$213,942.61",
    errors: "33"
  },
  {
    id: "2",
    identifier: "",
    date: "May 11, 2025",
    carryForwardIn: "-$252,251.22",
    totalAmount: "$319,866.14",
    reportTotal: "$588,240.74",
    totalPaid: "$523,292.29",
    totalNet: "$64,948.45",
    carryForwardOut: "-$203,426.15",
    errors: "38"
  },
  {
    id: "3",
    identifier: "",
    date: "May 4, 2025",
    carryForwardIn: "-$1,005,805.73",
    totalAmount: "-$202,041.05",
    reportTotal: "$41,965.46",
    totalPaid: "$50,210.17",
    totalNet: "-$8,244.71",
    carryForwardOut: "-$252,251.22",
    errors: "0"
  },
  {
    id: "4",
    identifier: "",
    date: "April 27, 2025",
    carryForwardIn: "-$841,230.97",
    totalAmount: "-$972,289.02",
    reportTotal: "-$41,258.43",
    totalPaid: "$33,979.90",
    totalNet: "-$75,238.33",
    carryForwardOut: "-$1,006,019.71",
    errors: "34"
  },
  {
    id: "5",
    identifier: "",
    date: "April 20, 2025",
    carryForwardIn: "-$749,383.81",
    totalAmount: "-$773,675.11",
    reportTotal: "$37,696.65",
    totalPaid: "$67,512.17",
    totalNet: "-$29,815.52",
    carryForwardOut: "-$841,230.97",
    errors: "58"
  },
  {
    id: "6",
    identifier: "",
    date: "April 14, 2025",
    carryForwardIn: "-$665,536.01",
    totalAmount: "-$544,585.02",
    reportTotal: "$224,303.33",
    totalPaid: "$204,784.97",
    totalNet: "$19,518.36",
    carryForwardOut: "-$749,383.81",
    errors: "92"
  },
  {
    id: "7",
    identifier: "",
    date: "April 6, 2025",
    carryForwardIn: "-$563,851.36",
    totalAmount: "-$560,227.57",
    reportTotal: "$105,724.25",
    totalPaid: "$105,652.10",
    totalNet: "$72.15",
    carryForwardOut: "-$665,536.01",
    errors: "56"
  },
  {
    id: "8",
    identifier: "",
    date: "March 30, 2025",
    carryForwardIn: "-$441,212.98",
    totalAmount: "-$532,101.73",
    reportTotal: "-$23,679.33",
    totalPaid: "$31,731.90",
    totalNet: "-$55,411.23",
    carryForwardOut: "-$563,851.36",
    errors: "46"
  },
  {
    id: "9",
    identifier: "",
    date: "March 23, 2025",
    carryForwardIn: "-$384,728.30",
    totalAmount: "-$378,360.42",
    reportTotal: "$35,887.94",
    totalPaid: "$63,375.78",
    totalNet: "-$27,487.84",
    carryForwardOut: "-$441,212.98",
    errors: "67"
  },
  {
    id: "10",
    identifier: "",
    date: "March 16, 2025",
    carryForwardIn: "-$338,652.92",
    totalAmount: "-$273,448.34",
    reportTotal: "$91,245.78",
    totalPaid: "$111,353.61",
    totalNet: "-$20,107.83",
    carryForwardOut: "-$384,728.30",
    errors: "90"
  },
  {
    id: "11",
    identifier: "",
    date: "March 9, 2025",
    carryForwardIn: "-$301,126.97",
    totalAmount: "-$93,703.72",
    reportTotal: "$258,570.09",
    totalPaid: "$245,120.65",
    totalNet: "$13,449.44",
    carryForwardOut: "-$338,661.33",
    errors: "115"
  },
  {
    id: "12",
    identifier: "",
    date: "March 2, 2025",
    carryForwardIn: "-$246,042.49",
    totalAmount: "-$243,749.77",
    reportTotal: "$48,258.40",
    totalPaid: "$58,437.27",
    totalNet: "-$10,178.87",
    carryForwardOut: "-$301,126.97",
    errors: "72"
  },
  {
    id: "13",
    identifier: "",
    date: "Feb. 23, 2025",
    carryForwardIn: "-$168,530.90",
    totalAmount: "-$189,715.81",
    reportTotal: "$12,120.37",
    totalPaid: "$56,326.68",
    totalNet: "-$44,206.31",
    carryForwardOut: "-$246,042.49",
    errors: "55"
  },
  {
    id: "14",
    identifier: "",
    date: "Feb. 16, 2025",
    carryForwardIn: "-$141,551.64",
    totalAmount: "-$57,805.55",
    reportTotal: "$100,104.40",
    totalPaid: "$110,663.38",
    totalNet: "-$10,558.98",
    carryForwardOut: "-$168,468.93",
    errors: "85"
  },
  {
    id: "15",
    identifier: "",
    date: "Feb. 9, 2025",
    carryForwardIn: "-$112,731.35",
    totalAmount: "$183,424.21",
    reportTotal: "$333,916.00",
    totalPaid: "$324,993.58",
    totalNet: "$8,922.42",
    carryForwardOut: "-$141,551.64",
    errors: "113"
  },
  {
    id: "16",
    identifier: "",
    date: "Feb. 2, 2025",
    carryForwardIn: "-$78,368.26",
    totalAmount: "-$48,032.23",
    reportTotal: "$49,253.45",
    totalPaid: "$64,699.12",
    totalNet: "-$15,445.67",
    carryForwardOut: "-$112,731.35",
    errors: "66"
  },
  {
    id: "17",
    identifier: "",
    date: "Jan. 26, 2025",
    carryForwardIn: "-$48,027.43",
    totalAmount: "-$4,793.73",
    reportTotal: "$51,834.36",
    totalPaid: "$73,574.53",
    totalNet: "-$21,740.17",
    carryForwardOut: "-$78,368.26",
    errors: "65"
  },
  {
    id: "18",
    identifier: "",
    date: "Jan. 19, 2025",
    carryForwardIn: "-$36,787.07",
    totalAmount: "$150,066.60",
    reportTotal: "$196,348.61",
    totalPaid: "$198,371.62",
    totalNet: "-$2,023.01",
    carryForwardOut: "-$48,027.43",
    errors: "99"
  }
]

export default function AgentPayrolls() {
  const router = useRouter()

  const handleRowClick = (payroll: any) => {
    // Navigate to payroll detail page using the date as identifier
    const payrollId = payroll.date.replace(/\s+/g, '-').replace(/,/g, '')
    router.push(`/payments/payrolls/${payrollId}`)
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Agent Payrolls</h1>
          <Button variant="blue" size="sm">
            New Payroll
          </Button>
        </div>
      </div>

      {/* Payrolls Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Identifier</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Carry Forward In</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total Amount</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Report Total</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total Paid</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total Net</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Carry Forward Out</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Errors</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {agentPayrolls.map((payroll) => (
                  <tr
                    key={payroll.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(payroll)}
                  >
                    <td className="py-3 px-4 text-gray-900">{payroll.identifier}</td>
                    <td className="py-3 px-4 text-gray-900">{payroll.date}</td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      payroll.carryForwardIn.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payroll.carryForwardIn}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      payroll.totalAmount.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payroll.totalAmount}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      payroll.reportTotal.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payroll.reportTotal}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {payroll.totalPaid}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      payroll.totalNet.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payroll.totalNet}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      payroll.carryForwardOut.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payroll.carryForwardOut}
                    </td>
                    <td className={`py-3 px-4 text-center ${
                      payroll.errors !== "0" ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payroll.errors}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          className="text-gray-400 hover:text-gray-600 p-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle edit action
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="text-red-400 hover:text-red-600 p-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle delete action
                          }}
                        >
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