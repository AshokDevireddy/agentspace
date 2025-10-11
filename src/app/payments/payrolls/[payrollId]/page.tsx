"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

// Mock payroll data - in real app this would come from API
const getPayrollData = (payrollId: string) => {
  // This would normally fetch from your backend
  return {
    id: payrollId,
    date: "May 18, 2025",
    status: "This payroll has been published and is available to agents",
    agentPayouts: [
      {
        agent: "Adams, Mark",
        carryForwardIn: "None",
        transactionTotal: "$423.43",
        adjustments: "None",
        amount: "$423.43",
        amountPaid: "$423.43",
        carryForwardOut: "$423.43"
      },
      {
        agent: "Adler, Yisroel",
        carryForwardIn: "$9.36",
        transactionTotal: "$355.27",
        adjustments: "None",
        amount: "$364.63",
        amountPaid: "$364.63",
        carryForwardOut: "$364.63"
      },
      {
        agent: "Agency, Nico & Alex",
        carryForwardIn: "$173.50",
        transactionTotal: "$1,186.56",
        adjustments: "None",
        amount: "$1,360.06",
        amountPaid: "$1,360.06",
        carryForwardOut: "$1,360.06"
      },
      {
        agent: "Aguiar, Aiden",
        carryForwardIn: "None",
        transactionTotal: "$440.58",
        adjustments: "None",
        amount: "$440.58",
        amountPaid: "$440.58",
        carryForwardOut: "$440.58"
      },
      {
        agent: "Allan, Nicholas",
        carryForwardIn: "$0.00",
        transactionTotal: "$126.25",
        adjustments: "None",
        amount: "$126.25",
        amountPaid: "$126.25",
        carryForwardOut: "$126.25"
      },
      {
        agent: "Almansur, Jonathan",
        carryForwardIn: "-$2,440.95",
        transactionTotal: "-$213.69",
        adjustments: "None",
        amount: "-$2,654.64",
        amountPaid: "-$2,654.64",
        carryForwardOut: "-$2,654.64"
      },
      {
        agent: "Alsheeblway, Monty",
        carryForwardIn: "-$307.11",
        transactionTotal: "-$384.32",
        adjustments: "None",
        amount: "-$691.43",
        amountPaid: "-$691.43",
        carryForwardOut: "-$691.43"
      },
      {
        agent: "Andrade, Maximus",
        carryForwardIn: "$0.00",
        transactionTotal: "-$312.13",
        adjustments: "None",
        amount: "-$312.13",
        amountPaid: "-$312.13",
        carryForwardOut: "-$312.13"
      },
      {
        agent: "Archer, Tavon",
        carryForwardIn: "None",
        transactionTotal: "-$106.49",
        adjustments: "None",
        amount: "-$106.49",
        amountPaid: "-$106.49",
        carryForwardOut: "-$106.49"
      },
      {
        agent: "Arias, Austin",
        carryForwardIn: "-$893.49",
        transactionTotal: "-$76.19",
        adjustments: "None",
        amount: "-$969.68",
        amountPaid: "-$969.68",
        carryForwardOut: "-$969.68"
      },
      {
        agent: "Bahu, Mikey",
        carryForwardIn: "$0.00",
        transactionTotal: "-$361.38",
        adjustments: "None",
        amount: "-$361.38",
        amountPaid: "-$361.38",
        carryForwardOut: "-$361.38"
      },
      {
        agent: "Bahu, Noah",
        carryForwardIn: "-$1,532.74",
        transactionTotal: "-$203.20",
        adjustments: "None",
        amount: "-$1,735.94",
        amountPaid: "-$1,735.94",
        carryForwardOut: "-$1,735.94"
      },
      {
        agent: "Bakerman, Jaxon",
        carryForwardIn: "None",
        transactionTotal: "-$604.84",
        adjustments: "None",
        amount: "-$604.84",
        amountPaid: "-$604.84",
        carryForwardOut: "-$604.84"
      },
      {
        agent: "Baski, Luca",
        carryForwardIn: "-$466.21",
        transactionTotal: "-$809.22",
        adjustments: "None",
        amount: "-$1,275.43",
        amountPaid: "-$1,275.43",
        carryForwardOut: "-$1,275.43"
      },
      {
        agent: "Baz, Amir",
        carryForwardIn: "$0.00",
        transactionTotal: "None",
        adjustments: "None",
        amount: "$0.00",
        amountPaid: "$0.00",
        carryForwardOut: "$0.00"
      }
    ],
    commissionReports: [
      {
        identifier: "AV029",
        file: "AmAm_AV24_fix.csv",
        carrier: "American Amicable / Occidental",
        date: "May 26, 2025",
        amount: "$713.00",
        status: "Completed",
        records: "1",
        total: "$713.00",
        errors: "0",
        errorAmount: "$0.00",
        loaded: "1",
        loadedAmount: "$713.00",
        timeCreated: "May 26, 2025, 1:50 a.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "RNA_AV029ajl.csv",
        carrier: "Royal Neighbors of America (RNA)",
        date: "May 22, 2025",
        amount: "$130.92",
        status: "Completed",
        records: "2",
        total: "$130.92",
        errors: "0",
        errorAmount: "$0.00",
        loaded: "2",
        loadedAmount: "$130.92",
        timeCreated: "May 25, 2025, 4:28 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "FOR_AV029ajl.csv",
        carrier: "Foresters Financial",
        date: "May 22, 2025",
        amount: "-$1,026.00",
        status: "Completed",
        records: "1",
        total: "-$1,026.00",
        errors: "0",
        errorAmount: "$0.00",
        loaded: "1",
        loadedAmount: "-$1,026.00",
        timeCreated: "May 25, 2025, 4:27 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "Balt_AV029ajl.csv",
        carrier: "Baltimore Life",
        date: "May 22, 2025",
        amount: "$5,273.66",
        status: "Completed",
        records: "12",
        total: "$5,273.66",
        errors: "0",
        errorAmount: "$0.00",
        loaded: "12",
        loadedAmount: "$5,273.66",
        timeCreated: "May 25, 2025, 4:27 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "AmAm_AV29ajl.csv",
        carrier: "American Amicable / Occidental",
        date: "May 22, 2025",
        amount: "$9,552.39",
        status: "Completed",
        records: "13",
        total: "$9,552.39",
        errors: "0",
        errorAmount: "$0.00",
        loaded: "13",
        loadedAmount: "$9,552.39",
        timeCreated: "May 25, 2025, 4:22 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "AHL_5.21ajl.xlsx",
        carrier: "American Home Life Insurance Company",
        date: "May 22, 2025",
        amount: "$418.30",
        status: "Completed",
        records: "4",
        total: "$418.30",
        errors: "0",
        errorAmount: "$0.00",
        loaded: "4",
        loadedAmount: "$418.30",
        timeCreated: "May 25, 2025, 4:07 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "AHL_5.17ajl.xlsx",
        carrier: "American Home Life Insurance Company",
        date: "May 22, 2025",
        amount: "-$121.39",
        status: "Completed",
        records: "2",
        total: "-$121.39",
        errors: "0",
        errorAmount: "$0.00",
        loaded: "2",
        loadedAmount: "-$121.39",
        timeCreated: "May 25, 2025, 4:07 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "Aflac_5.21ajl.xlsx",
        carrier: "Aflac",
        date: "May 22, 2025",
        amount: "-$24,010.97",
        status: "Completed",
        records: "170",
        total: "-$24,010.97",
        errors: "6",
        errorAmount: "$2,878.35",
        loaded: "164",
        loadedAmount: "-$26,889.32",
        timeCreated: "May 25, 2025, 3:53 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "Aflac_5.17ajl.xlsx",
        carrier: "Aflac",
        date: "May 22, 2025",
        amount: "$2,065.61",
        status: "Completed",
        records: "116",
        total: "$2,065.61",
        errors: "5",
        errorAmount: "-$119.52",
        loaded: "111",
        loadedAmount: "$2,185.13",
        timeCreated: "May 25, 2025, 3:53 p.m.",
        payroll: "2025-05-22"
      },
      {
        identifier: "AV029",
        file: "Aetna_5.21ajl.xlsx",
        carrier: "Aetna",
        date: "May 22, 2025",
        amount: "-$21,993.67",
        status: "Completed",
        records: "155",
        total: "-$21,993.67",
        errors: "3",
        errorAmount: "-$650.61",
        loaded: "152",
        loadedAmount: "-$21,343.06",
        timeCreated: "May 25, 2025, 3:52 p.m.",
        payroll: "2025-05-22"
      }
    ]
  }
}

export default function PayrollDetail() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("payouts")

  const payrollId = params.payrollId as string
  const payroll = getPayrollData(payrollId)

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Agent Payrolls</h1>
          <div className="ml-auto flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Pay all balances
            </Button>
            <Button variant="blue" size="sm">
              Update Payroll
            </Button>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className="mb-8 p-4 bg-green-100 border border-green-200 rounded-lg">
        <p className="text-green-800">{payroll.status}</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("payouts")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "payouts"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Agent Payouts
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "reports"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Commission Reports
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "payouts" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Agent</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Carry Forward In</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Transaction Total</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Adjustments</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-600">Amount</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-600">Amount Paid</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-600">Carry Forward Out</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.agentPayouts.map((payout, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-6 text-gray-900">{payout.agent}</td>
                      <td className="py-4 px-6 text-gray-900">{payout.carryForwardIn}</td>
                      <td className="py-4 px-6 text-gray-900">{payout.transactionTotal}</td>
                      <td className="py-4 px-6 text-gray-900">{payout.adjustments}</td>
                      <td className={`py-4 px-6 text-right font-medium ${
                        payout.amount.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {payout.amount}
                      </td>
                      <td className={`py-4 px-6 text-right font-medium ${
                        payout.amountPaid.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {payout.amountPaid}
                      </td>
                      <td className={`py-4 px-6 text-right font-medium ${
                        payout.carryForwardOut.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {payout.carryForwardOut}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "reports" && (
        <Card>
          <CardContent className="p-0">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Commission Reports</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Identifier</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">File</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Carrier</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Records</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Errors</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Error Amount</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Loaded</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Loaded Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Time Created</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Payroll</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.commissionReports.map((report, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{report.identifier}</td>
                      <td className="py-3 px-4 text-gray-900">{report.file}</td>
                      <td className="py-3 px-4 text-gray-900">{report.carrier}</td>
                      <td className="py-3 px-4 text-gray-900">{report.date}</td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        report.amount.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {report.amount}
                      </td>
                      <td className="py-3 px-4 text-gray-900">{report.status}</td>
                      <td className="py-3 px-4 text-center text-gray-900">{report.records}</td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        report.total.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {report.total}
                      </td>
                      <td className={`py-3 px-4 text-center ${
                        report.errors !== "0" ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {report.errors}
                      </td>
                      <td className={`py-3 px-4 text-right ${
                        report.errorAmount !== "$0.00" ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {report.errorAmount}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-900">{report.loaded}</td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        report.loadedAmount.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {report.loadedAmount}
                      </td>
                      <td className="py-3 px-4 text-gray-900">{report.timeCreated}</td>
                      <td className="py-3 px-4 text-gray-900">{report.payroll}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}