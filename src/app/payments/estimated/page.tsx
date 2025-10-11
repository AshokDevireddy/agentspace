"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import Link from "next/link"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

// Dummy data for the chart
const chartData = [
  { period: '5-19', amount: 40000 },
  { period: '5-20', amount: 45000 },
  { period: '5-21', amount: 150000 },
  { period: '5-22', amount: 40000 },
  { period: '5-23', amount: 75000 },
  { period: '5-24', amount: 30000 },
  { period: '5-25', amount: 20000 },
]

// Time period options
const timePeriodOptions = [
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "last-quarter", label: "Last Quarter" },
]

// Dummy estimated commissions data
const estimatedCommissions = [
  {
    id: "1",
    agent: "Baski, Luca",
    carrier: "Aetna",
    amount: "$310.09",
    effectiveDate: "May 21, 2025",
    rate: "17.50%",
    applicationDate: "May 9, 2025",
    policyNumber: "ACC7039538",
    hasSplit: false
  },
  {
    id: "2",
    agent: "Callahan, Tyson",
    carrier: "American Amicable / Occidental",
    amount: "$264.00",
    effectiveDate: "May 19, 2025",
    rate: "20.00%",
    applicationDate: "May 9, 2025",
    policyNumber: "M002518617",
    hasSplit: false
  },
  {
    id: "3",
    agent: "Callahan, Tyson",
    carrier: "American Amicable / Occidental",
    amount: "$266.40",
    effectiveDate: "May 19, 2025",
    rate: "20.00%",
    applicationDate: "May 9, 2025",
    policyNumber: "M002518522",
    hasSplit: false
  },
  {
    id: "4",
    agent: "Schwartz, Joseph",
    carrier: "American Amicable / Occidental",
    amount: "$237.34",
    effectiveDate: "May 23, 2025",
    rate: "110.00%",
    applicationDate: "May 8, 2025",
    policyNumber: "002522955",
    hasSplit: true,
    splitInfo: "50.00% split from Leiter, Seth"
  },
  {
    id: "5",
    agent: "Shrier, Hunter",
    carrier: "Aflac",
    amount: "$128.04",
    effectiveDate: "May 24, 2025",
    rate: "23.00%",
    applicationDate: "May 8, 2025",
    policyNumber: "TER6386168",
    hasSplit: false
  },
  {
    id: "6",
    agent: "Schwartz, Joseph",
    carrier: "American Amicable / Occidental",
    amount: "$139.13",
    effectiveDate: "May 19, 2025",
    rate: "20.00%",
    applicationDate: "May 8, 2025",
    policyNumber: "M2522625",
    hasSplit: true,
    splitInfo: "50.00% split from Rojas, Joshua Benjamin"
  },
  {
    id: "7",
    agent: "Schwartz, Joseph",
    carrier: "American Amicable / Occidental",
    amount: "$869.55",
    effectiveDate: "May 19, 2025",
    rate: "125.00%",
    applicationDate: "May 8, 2025",
    policyNumber: "M2522625",
    hasSplit: true,
    splitInfo: "50.00% split from Rojas, Joshua Benjamin"
  },
  {
    id: "8",
    agent: "Phillips, Adam",
    carrier: "Aetna",
    amount: "$136.90",
    effectiveDate: "May 23, 2025",
    rate: "17.50%",
    applicationDate: "May 8, 2025",
    policyNumber: "ACC7038963",
    hasSplit: false
  },
  {
    id: "9",
    agent: "Colecchi, Jack",
    carrier: "American Amicable / Occidental",
    amount: "$124.70",
    effectiveDate: "May 19, 2025",
    rate: "20.00%",
    applicationDate: "May 8, 2025",
    policyNumber: "M002521047",
    hasSplit: false
  }
]

export default function EstimatedPayouts() {
  const [selectedTimePeriod, setSelectedTimePeriod] = useState("this-week")

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Estimated Payouts</h1>
          <div className="flex items-center space-x-4">
            <SimpleSearchableSelect
              options={timePeriodOptions}
              value={selectedTimePeriod}
              onValueChange={setSelectedTimePeriod}
              placeholder="This Week"
              searchPlaceholder="Search time periods..."
            />
            <span className="text-sm text-gray-600">May 19, 2025 - May 25, 2025</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-gray-600 mb-2">Gross Commission</h3>
            <p className="text-3xl font-bold text-gray-900">$133,520.55</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-gray-600 mb-2">Families Protected</h3>
            <p className="text-3xl font-bold text-gray-900">448</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Total by Effective Date</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db' }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Estimated Commissions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Estimated Commissions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 font-medium text-gray-600">Agent</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600">Carrier</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-600">Amount</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600">Effective Date</th>
                  <th className="text-center py-4 px-6 font-medium text-gray-600">Rate</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600">Application Date</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600">Policy Number</th>
                </tr>
              </thead>
              <tbody>
                {estimatedCommissions.map((commission) => (
                  <tr key={commission.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div>
                        <div className="text-gray-900">{commission.agent}</div>
                        {commission.hasSplit && (
                          <div className="text-xs text-blue-600 mt-1">
                            {commission.splitInfo}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-900">{commission.carrier}</td>
                    <td className="py-4 px-6 text-right text-gray-900 font-semibold">{commission.amount}</td>
                    <td className="py-4 px-6 text-gray-900">{commission.effectiveDate}</td>
                    <td className="py-4 px-6 text-center text-gray-900">{commission.rate}</td>
                    <td className="py-4 px-6 text-gray-900">{commission.applicationDate}</td>
                    <td className="py-4 px-6">
                      <Link
                        href={`/policies/${encodeURIComponent(commission.carrier)}/${encodeURIComponent(commission.policyNumber)}`}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {commission.policyNumber}
                      </Link>
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