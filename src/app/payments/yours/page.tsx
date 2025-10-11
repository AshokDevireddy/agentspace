"use client"

import { Card, CardContent } from "@/components/ui/card"

// Dummy payouts data matching the uploaded image
const payouts = [
  { payrollDate: "May 18, 2025", amountPaid: "$32,602.31" },
  { payrollDate: "May 11, 2025", amountPaid: "$197,437.62" },
  { payrollDate: "May 4, 2025", amountPaid: "$9,697.43" },
  { payrollDate: "April 27, 2025", amountPaid: "-$8,008.60" },
  { payrollDate: "April 20, 2025", amountPaid: "$6,911.35" },
  { payrollDate: "April 14, 2025", amountPaid: "$37,899.04" },
  { payrollDate: "April 6, 2025", amountPaid: "$21,976.42" },
  { payrollDate: "March 30, 2025", amountPaid: "-$5,174.31" },
  { payrollDate: "March 23, 2025", amountPaid: "$11,146.46" },
  { payrollDate: "March 16, 2025", amountPaid: "$14,189.27" },
  { payrollDate: "March 9, 2025", amountPaid: "$44,361.17" },
  { payrollDate: "March 2, 2025", amountPaid: "$11,803.28" },
  { payrollDate: "Feb. 23, 2025", amountPaid: "$6,876.12" },
  { payrollDate: "Feb. 16, 2025", amountPaid: "$34,990.17" },
  { payrollDate: "Feb. 9, 2025", amountPaid: "$125,150.61" },
  { payrollDate: "Feb. 2, 2025", amountPaid: "$25,252.35" },
  { payrollDate: "Jan. 26, 2025", amountPaid: "$28,576.63" },
  { payrollDate: "Jan. 19, 2025", amountPaid: "$87,534.33" }
]

export default function YourPayouts() {
  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Payouts</h1>
      </div>

      {/* Payouts Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 font-medium text-gray-600">Payroll Date</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-600">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6 text-gray-900">{payout.payrollDate}</td>
                    <td className={`py-4 px-6 text-right font-semibold ${
                      payout.amountPaid.startsWith('-') ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payout.amountPaid}
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