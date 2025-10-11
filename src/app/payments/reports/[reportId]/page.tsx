"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Edit } from "lucide-react"
import Link from "next/link"
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CommissionReportData {
  id: string
  report_name: string
  original_filename: string
  file_path: string
  file_size: number
  file_type: string
  status: string
  record_count: number
  processed_count: number
  error_count: number
  total_amount: number
  upload_date: string
  created_at: string
  carrier_id: string
  carriers: {
    name: string
  }
  agencies: {
    name: string
    code: string
  }
  commissions: Array<{
    id: string
    agent_id: string
    amount: number
    status: string
    commission_type: string
    deal_id: string | null
    deal: {
      policy_number: string
      client_name: string
      carrier_id: string
      writing_agent_number: string | null
    }
    agent: {
      first_name: string
      last_name: string
      agent_carrier_numbers: Array<{
        agent_number: string
      }>
    }
  }>
}

export default function CommissionReportDetail() {
  const params = useParams()
  const router = useRouter()
  const [report, setReport] = useState<CommissionReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const reportId = params.reportId as string

  useEffect(() => {
    fetchReportData()
  }, [reportId])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('commission_reports')
        .select(`
          *,
          carriers!inner(name),
          agencies!inner(name, code),
          commissions(
            id,
            agent_id,
            deal_id,
            amount,
            status,
            commission_type,
            deal:deal_id(policy_number, client_name, carrier_id, writing_agent_number),
            agent:agent_id(
              first_name,
              last_name,
              agent_carrier_numbers(agent_number)
            )
          )
        `)
        .eq('id', reportId)
        .single()

      if (error) {
        throw error
      }

      setReport(data)
    } catch (err) {
      console.error('Error fetching report:', err)
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

    const handleDownload = async () => {
    if (!report) return

    try {
      setDownloading(true)

      // Get the current session to get the access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        alert('Please log in to download files')
        return
      }

      const response = await fetch(`/api/commission-reports/${reportId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Download failed')
      }

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = report.original_filename || report.report_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Download error:', err)
      alert(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading commission report...</div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-destructive">{error || 'Report not found'}</div>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'uploaded':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
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
          <h1 className="text-4xl font-bold text-gradient">Commission Report</h1>
          <div className="ml-auto flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
              onClick={handleDownload}
              disabled={downloading || !report.file_path}
            >
              <Download className="h-4 w-4" />
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </Button>
            <Button className="btn-gradient flex items-center space-x-2" size="sm">
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Report Information */}
      <Card className="professional-card">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">{report.original_filename || report.report_name}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <div className={`mt-1 font-medium ${getStatusColor(report.status)}`}>
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">Carrier:</span>
              <div className="mt-1 text-foreground">{report.carriers.name}</div>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">Agency:</span>
              <div className="mt-1 text-foreground">{report.agencies.name}</div>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">Records:</span>
              <div className="mt-1 text-foreground">{report.record_count} [{formatCurrency(report.total_amount)}]</div>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">Processed:</span>
              <div className="mt-1 text-foreground">{report.processed_count}</div>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">Errors:</span>
              <div className={`mt-1 ${report.error_count > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {report.error_count}
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">File Size:</span>
              <div className="mt-1 text-foreground">{(report.file_size / 1024).toFixed(1)} KB</div>
            </div>

            <div>
              <span className="text-sm font-medium text-muted-foreground">Upload Date:</span>
              <div className="mt-1 text-foreground">{formatDate(report.upload_date)}</div>
            </div>

            <div className="md:col-span-2">
              <span className="text-sm font-medium text-muted-foreground">Created on:</span>
              <div className="mt-1 text-foreground">{formatDate(report.created_at)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Transactions */}
      <Card className="professional-card">
        <CardContent className="p-0">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Commission Transactions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Showing {report.commissions.length} commission transactions generated from this report
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Policy Number</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Agent Name</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Agent Number</th>
                  <th className="text-left py-4 px-6 font-medium text-muted-foreground">Commission Type</th>
                  <th className="text-right py-4 px-6 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center py-4 px-6 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.commissions && report.commissions.length > 0 ? (
                  report.commissions.map((commission) => {
                    const agentName = `${commission.agent?.first_name || ''} ${commission.agent?.last_name || ''}`.trim()
                    const agentNumber = commission.deal?.writing_agent_number || 'N/A'

                    return (
                      <tr key={commission.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                        <td className="py-4 px-6">
                          {commission.deal ? (
                            <Link
                              href={`/policies/${commission.deal.carrier_id}/${commission.deal.policy_number}`}
                              className="text-primary hover:text-primary/80 underline"
                            >
                              {commission.deal.policy_number}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-foreground">{commission.deal?.client_name || 'N/A'}</td>
                        <td className="py-4 px-6 text-foreground">{agentName || 'N/A'}</td>
                        <td className="py-4 px-6 text-foreground">{agentNumber}</td>
                        <td className="py-4 px-6 text-foreground">{commission.commission_type || 'N/A'}</td>
                        <td className="py-4 px-6 text-right font-medium text-foreground">
                          {formatCurrency(commission.amount)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              commission.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}
                          >
                            {commission.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 px-6 text-center text-muted-foreground">
                      No commission transactions found for this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}