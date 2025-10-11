"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Edit, Trash2 } from "lucide-react"
import CommissionReportDropdown from "@/components/commission-report-dropdown"
import { useAuth } from "@/providers/AuthProvider"
import { createClient } from "@/lib/supabase/client"

// Define the structure of a commission report
interface CommissionReport {
  id: string
  identifier: string // Placeholder, can be derived from ID
  report_name: string
  carriers: { name: string } | null
  upload_date: string
  total_amount: number
  status: string
  record_count: number
}

export default function CommissionReports() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const [reports, setReports] = useState<CommissionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCommissionReports = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Step 1: Get the user's agency_id from the 'users' table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("agency_id")
          .eq("auth_user_id", user.id)
          .single()

        if (userError || !userData) {
          throw new Error("Failed to fetch user agency information.")
        }

        const agencyId = userData.agency_id

        if (!agencyId) {
          throw new Error("User is not associated with an agency.")
        }

        // Step 2: Fetch commission reports for that agency
        const { data: reportsData, error: reportsError } = await supabase
          .from("commission_reports")
          .select(`
            id,
            report_name,
            upload_date,
            total_amount,
            status,
            record_count,
            carriers (
              name
            )
          `)
          .eq("agency_id", agencyId)
          .order("upload_date", { ascending: false })

        if (reportsError) {
          throw new Error("Failed to fetch commission reports.")
        }

        // Map the fetched data to the component's expected structure
        const formattedReports = reportsData.map(report => ({
          ...report,
          identifier: `AV${report.id.substring(0, 4)}`, // Placeholder identifier
        })) as unknown as CommissionReport[]

        setReports(formattedReports)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCommissionReports()
  }, [user, supabase])

  const handleRowClick = (report: CommissionReport) => {
    // Navigate to commission report detail page
    router.push(`/payments/reports/${report.id}`)
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || isNaN(amount)) {
      return "$0.00"
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold text-gradient">Commission Reports</h1>
          <CommissionReportDropdown />
        </div>
      </div>

      {/* Commission Reports Table */}
      <Card className="professional-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Identifier</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">File</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Carrier</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Records</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-6 text-center text-muted-foreground">
                      Loading reports...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-6 text-center text-destructive">
                      Error: {error}
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-6 text-center text-muted-foreground">
                      No commission reports found.
                    </td>
                  </tr>
                ) : (
                  reports.map(report => (
                    <tr
                      key={report.id}
                      onClick={() => handleRowClick(report)}
                      className="border-b border-border hover:bg-accent/30 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 text-foreground">{report.identifier}</td>
                      <td className="py-4 px-6 text-foreground">{report.report_name}</td>
                      <td className="py-4 px-6 text-foreground">{report.carriers?.name || "N/A"}</td>
                      <td className="py-4 px-6 text-foreground">
                        {new Date(report.upload_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-6 text-foreground font-medium" style={{ color: report.total_amount < 0 ? '#ef4444' : 'inherit' }}>
                        {formatCurrency(report.total_amount)}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            report.status === "processed"
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-foreground">{report.record_count}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}