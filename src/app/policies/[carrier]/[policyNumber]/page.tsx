"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit } from "lucide-react"
import Link from "next/link"
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PolicyData {
  id: string
  carrier: { name: string }
  policy_number: string
  policy_effective_date: string
  client_name: string
  product: { name: string }
  annual_premium: number
  status: string
  commissions: CommissionSnapshot[]
  transactionHistory: CommissionTransaction[]
}

interface CommissionSnapshot {
  agent: { id: string, first_name: string, last_name: string, agent_number: string | null }
  position: { name: string }
  amount: number // This will be calculated
  rate: number
  level: number
  isWritingAgent: boolean
  uplineOf: string | null
}

interface CommissionTransaction {
  id: string
  created_at: string
  agent: { first_name: string, last_name: string }
  commission_type: string
  amount: number
  commission_report: { id: string, report_name: string }
}

const positionColors = {
  "Legacy Junior Partner": "bg-blue-100 text-blue-800",
  "Legacy GA": "bg-green-100 text-green-800",
  "Legacy SA": "bg-purple-100 text-purple-800",
  "Supervising Agent 2": "bg-orange-100 text-orange-800",
  "Supervising Agent 1": "bg-red-100 text-red-800",
  "Brokerage Agent": "bg-cyan-100 text-cyan-800",
  "Prodigy": "bg-indigo-100 text-indigo-800"
};

export default function PolicyDetail() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("splits")
  const [policy, setPolicy] = useState<PolicyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carrierId = decodeURIComponent(params.carrier as string)
  const policyNumber = params.policyNumber as string

  useEffect(() => {
    const fetchPolicyData = async () => {
      if (!carrierId || !policyNumber) return

      try {
        setLoading(true)

        // First, get the deal and find the writing agent
        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .select(`
            id,
            agent_id,
            policy_number,
            policy_effective_date,
            client_name,
            annual_premium,
            status,
            carrier:carrier_id!inner(name),
            product:product_id(name),
            transactions:commissions(
              id,
              created_at,
              commission_type,
              amount,
              agent_id,
              agent:agent_id(first_name, last_name),
              commission_report:commission_report_id(id, report_name)
            )
          `)
          .eq('policy_number', policyNumber)
          .eq('carrier_id', carrierId)
          .single()
        console.log('Policy debug: deal', deal);

        if (dealError) throw dealError
        if (!deal) throw new Error("Policy not found.")

        // Calculate agent earnings from transactions
        const agentEarnings = new Map<string, number>();
        (deal.transactions || []).forEach((t: any) => {
          if (t.agent_id) {
            const currentAmount = agentEarnings.get(t.agent_id) || 0;
            agentEarnings.set(t.agent_id, currentAmount + t.amount);
          }
        });

        // Determine writing agent: prefer the deal's agent_id; fallback to highest earner
        let writingAgentId: string | null = (deal as any).agent_id || null;
        if (!writingAgentId) {
          let maxAmount = 0;
          agentEarnings.forEach((amount, agentId) => {
            if (amount > maxAmount) {
              maxAmount = amount;
              writingAgentId = agentId;
            }
          });
        }

        if (!writingAgentId) {
          console.error('Policy debug: deal row', deal);
          console.error('Policy debug: no writing agent found; transactions', deal.transactions);
          throw new Error("No writing agent found for this policy.");
        }

        console.log('Policy debug: writingAgentId', writingAgentId);
        // Load all snapshots for this deal and create a map by agent_id for quick traversal
        const { data: snapshots, error: snapshotsError } = await supabase
          .from('commission_snapshots')
          .select(`
            agent_id,
            upline_agent_id,
            level,
            percentage,
            agent:agent_id(first_name, last_name, agent_number),
            position:position_id(name)
          `)
          .eq('deal_id', (deal as any).id)
          .order('level');

        if (snapshotsError) {
          console.error('Policy debug: error loading commission_snapshots', snapshotsError);
        } else {
          console.log('Policy debug: loaded commission_snapshots count', (snapshots || []).length);
        }

        const snapshotByAgentId = new Map<string, any>();
        (snapshots || []).forEach((s: any) => snapshotByAgentId.set(s.agent_id, s));

        const uplineChain: CommissionSnapshot[] = [];
        let currentAgentId: string | null = writingAgentId;
        while (currentAgentId) {
          const snap = snapshotByAgentId.get(currentAgentId);
          if (!snap) {
            console.warn('Policy debug: no snapshot found for agent', currentAgentId, 'deal', (deal as any).id);
            break;
          }
          const agentObj = Array.isArray(snap.agent) ? snap.agent[0] : snap.agent;
          const positionObj = Array.isArray(snap.position) ? snap.position[0] : snap.position;
          uplineChain.push({
            agent: {
              id: snap.agent_id,
              first_name: agentObj?.first_name || 'N/A',
              last_name: agentObj?.last_name || 'N/A',
              agent_number: agentObj?.agent_number || null
            },
            position: positionObj || { name: 'N/A' },
            amount: agentEarnings.get(snap.agent_id) || 0,
            rate: snap.percentage,
            level: snap.level,
            isWritingAgent: uplineChain.length === 0,
            uplineOf: null
          });
          console.log('Policy debug: appended snapshot for agent', snap.agent_id, 'level', snap.level, 'percentage', snap.percentage);
          currentAgentId = snap.upline_agent_id;
        }

        const formattedPolicy: PolicyData = {
          id: deal.id,
          carrier: Array.isArray(deal.carrier) ? deal.carrier[0] : deal.carrier,
          policy_number: deal.policy_number,
          policy_effective_date: deal.policy_effective_date,
          client_name: deal.client_name,
          product: deal.product ? (Array.isArray(deal.product) ? deal.product[0] : deal.product) : { name: 'N/A' },
          annual_premium: deal.annual_premium,
          status: deal.status,
          commissions: uplineChain,
          transactionHistory: (deal.transactions || []).map((t: any) => ({
            ...t,
            agent: Array.isArray(t.agent) ? t.agent[0] : t.agent,
            commission_report: Array.isArray(t.commission_report) ? t.commission_report[0] : t.commission_report
          }))
        };

        setPolicy(formattedPolicy)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load policy details.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchPolicyData()
  }, [carrierId, policyNumber])


  // Function to render agent hierarchy with indentation
  const renderAgentHierarchy = (commissions: any[]) => {
    // Reverse the order so writing agent is at the bottom
    const reversedCommissions = [...commissions].reverse();
    return reversedCommissions.map((commission, index) => {
      // Calculate indentation: writing agent (highest level) gets most indent, top level gets least
      const maxLevel = Math.max(...commissions.map(c => c.level));
      const indentLevel = maxLevel - commission.level;

      return (
        <tr key={index} className="border-b border-gray-600 hover:bg-gray-700 transition-colors duration-150">
          <td className="py-6 px-6">
            <div className="flex items-center space-x-3">
              <div style={{ marginLeft: `${indentLevel * 24}px` }} className="flex items-center space-x-3">
                <Badge
                  className={`${positionColors[commission.position?.name as keyof typeof positionColors] || 'bg-gray-600 text-gray-200'} border-0 text-sm font-semibold px-3 py-1`}
                  variant="outline"
                >
                  {commission.position?.name || 'N/A'}
                </Badge>
                <div>
                  <span className="text-white font-semibold text-lg">
                    {commission.agent?.first_name} {commission.agent?.last_name}
                    {commission.agent?.agent_number && ` (${commission.agent.agent_number})`}
                  </span>
                  {commission.isWritingAgent && (
                    <span className="ml-3 text-sm bg-blue-500 text-white px-3 py-1 rounded-full font-medium">Writing Agent</span>
                  )}
                  {commission.uplineOf && (
                    <div className="text-sm text-gray-300 mt-1">Upline of: {commission.uplineOf}</div>
                  )}
                </div>
              </div>
            </div>
          </td>
          <td className="py-6 px-6 text-right text-white font-bold text-lg">
            ${commission.amount.toFixed(2)}
          </td>
          <td className="py-6 px-6 text-right text-white font-semibold text-lg">
            {commission.rate}%
          </td>
        </tr>
      )
    })
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (loading) return <div className="space-y-6 text-center"><div className="text-muted-foreground">Loading...</div></div>
  if (error) return <div className="space-y-6 text-center"><div className="text-destructive">Error: {error}</div></div>
  if (!policy) return <div className="space-y-6 text-center"><div className="text-muted-foreground">Policy not found.</div></div>

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
          <h1 className="text-4xl font-bold text-gradient">
            {policy.carrier?.name || 'N/A'}: {policy.policy_number}
          </h1>
          <span className="ml-4 text-primary bg-primary/10 px-3 py-1 rounded-full text-sm font-medium border border-primary/30">
            LOA
          </span>
          <Button className="btn-gradient ml-auto" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Policy Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="professional-card">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Policy Details</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Effective Date:</span>
                <span className="ml-2 text-foreground">{formatDate(policy.policy_effective_date)}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Client:</span>
                <span className="ml-2 text-primary underline cursor-pointer">
                  {policy.client_name}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Product:</span>
                <span className="ml-2 text-foreground">{policy.product?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Annual Premium:</span>
                <span className="ml-2 text-foreground font-semibold">${policy.annual_premium.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Badge className="ml-2 bg-primary/20 text-primary border border-primary/30">
                  {policy.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                View Transaction History
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Download Policy Documents
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Contact Client
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Update Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex space-x-1 bg-accent/50 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("splits")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "splits"
                ? "bg-primary text-primary-foreground btn-gradient"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Splits
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground btn-gradient"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Transaction History
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "splits" && (
        <>
          {/* Commissions Table */}
          <Card className="professional-card">
            <CardContent className="p-0">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Commissions</h3>
                <p className="text-sm text-muted-foreground mt-1">Agent hierarchy showing your downline only</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-500 bg-gradient-to-r from-gray-700 to-gray-800">
                      <th className="text-left py-6 px-6 font-bold text-white text-lg">Agent</th>
                      <th className="text-right py-6 px-6 font-bold text-white text-lg">Amount</th>
                      <th className="text-right py-6 px-6 font-bold text-white text-lg">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policy.commissions && policy.commissions.length > 0 ? (
                      renderAgentHierarchy(policy.commissions)
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 px-6 text-center text-muted-foreground">
                          No commission split information available for this policy.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "history" && (
        <Card className="professional-card">
          <CardContent className="p-0">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Transaction History</h3>
              <p className="text-sm text-muted-foreground mt-1">All commission report records for this policy</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/50">
                    <th className="text-left py-4 px-6 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-4 px-6 font-medium text-muted-foreground">Agent</th>
                    <th className="text-left py-4 px-6 font-medium text-muted-foreground">Type</th>
                    <th className="text-right py-4 px-6 font-medium text-muted-foreground">Transaction Amount</th>
                    <th className="text-left py-4 px-6 font-medium text-muted-foreground">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {policy.transactionHistory && policy.transactionHistory.length > 0 ? (
                    policy.transactionHistory.map((transaction, index) => (
                      <tr key={index} className="border-b border-border hover:bg-accent/30 transition-colors">
                        <td className="py-4 px-6 text-foreground">{formatDate(transaction.created_at)}</td>
                        <td className="py-4 px-6 text-foreground">{transaction.agent.first_name} {transaction.agent.last_name}</td>
                        <td className="py-4 px-6 text-foreground">{transaction.commission_type}</td>
                        <td className={`py-4 px-6 text-right font-medium ${
                          transaction.amount < 0 ? 'text-destructive' : 'text-foreground'
                        }`}>
                          ${transaction.amount.toFixed(2)}
                        </td>
                        <td className="py-4 px-6">
                          {transaction.commission_report ? (
                            <Link
                              href={`/payments/reports/${transaction.commission_report.id}`}
                              className="text-primary hover:text-primary/80 underline"
                            >
                              {transaction.commission_report.report_name}
                            </Link>
                          ) : (
                            <span className="text-foreground">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 px-6 text-center text-muted-foreground">
                        No transaction history available for this policy.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}