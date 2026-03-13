"use client"

import React, { useState } from "react"
import { Building2, Users, CreditCard, Loader2, AlertTriangle } from "lucide-react"
import { TIER_LIMITS } from "@/lib/subscription-tiers"
import { useAgencyBillingDashboard } from "@/hooks/queries/useAgencyBillingDashboard"
import {
  useEnableAgencyBilling,
  useDisableAgencyBilling,
  useChangeAgencyTier,
  useAgencyBillingPortal,
} from "@/hooks/mutations"
import { useNotification } from "@/contexts/notification-context"
import { cn } from "@/lib/utils"
import { formatRenewalDate } from "@/lib/date-utils"

type BillingTier = 'basic' | 'pro' | 'expert'

const TIERS: BillingTier[] = ['basic', 'pro', 'expert']

export function AgencyBillingDashboard() {
  const { showSuccess, showError } = useNotification()
  const [selectedTier, setSelectedTier] = useState<BillingTier>('pro')

  const { data: dashboard, isLoading } = useAgencyBillingDashboard()

  const enableMutation = useEnableAgencyBilling({
    onSuccess: (url) => { window.location.href = url },
    onError: (e) => showError(e.message),
  })

  const disableMutation = useDisableAgencyBilling({
    onSuccess: () => showSuccess('Agency billing will cancel at the end of the billing period'),
    onError: (e) => showError(e.message),
  })

  const changeTierMutation = useChangeAgencyTier({
    onSuccess: (data) => {
      if (data.status === 'upgraded') {
        showSuccess(`Upgraded to ${data.newTier} tier`)
      } else {
        showSuccess(`Downgrade to ${data.newTier} scheduled for ${formatRenewalDate(data.effectiveDate)}`)
      }
    },
    onError: (e) => showError(e.message),
  })

  const portalMutation = useAgencyBillingPortal({
    onSuccess: (url) => { window.location.href = url },
    onError: (e) => showError(e.message),
  })

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not yet enabled — show enable UI
  if (!dashboard?.enabled) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-bold text-foreground">Agency Billing</h3>
          </div>
          <p className="text-muted-foreground mb-6">
            Pay for all agents in your agency with a single subscription.
            Each agent will automatically receive the selected tier.
          </p>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {TIERS.map((tier) => {
              const limits = TIER_LIMITS[tier]
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left",
                    selectedTier === tier
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <p className="font-bold text-lg capitalize">{limits.name}</p>
                  <p className="text-2xl font-extrabold text-primary mt-1">${limits.price}<span className="text-sm font-normal text-muted-foreground">/agent/mo</span></p>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => enableMutation.mutate({ tier: selectedTier })}
            disabled={enableMutation.isPending}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {enableMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
            ) : (
              `Enable Agency Billing — ${TIER_LIMITS[selectedTier].name} Tier`
            )}
          </button>
        </div>
      </div>
    )
  }

  // Enabled — show dashboard
  const rawTier = dashboard.tier
  const tier: BillingTier = rawTier === 'basic' || rawTier === 'pro' || rawTier === 'expert' ? rawTier : 'basic'
  const limits = TIER_LIMITS[tier]

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Overview */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-bold text-foreground">Agency Billing</h3>
          </div>
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
            Active
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground">Current Tier</p>
            <p className="text-2xl font-bold capitalize">{limits.name}</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Agents</p>
            </div>
            <p className="text-2xl font-bold">{dashboard.seatCount}</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-1">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Monthly Total</p>
            </div>
            <p className="text-2xl font-bold">${dashboard.totalMonthlyCost}</p>
            <p className="text-xs text-muted-foreground">${dashboard.perSeatCost}/agent</p>
          </div>
        </div>

        {dashboard.billingCycleEnd && (
          <div className="p-3 bg-muted/30 rounded-lg border border-border mb-4">
            <p className="text-sm text-muted-foreground">
              Next billing date: <span className="font-medium text-foreground">{formatRenewalDate(dashboard.billingCycleEnd)}</span>
            </p>
          </div>
        )}

        {dashboard.scheduledTierChange && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Scheduled change to <span className="font-semibold capitalize">{dashboard.scheduledTierChange}</span> on {formatRenewalDate(dashboard.scheduledTierChangeDate)}
              </p>
            </div>
          </div>
        )}

        {/* Change Tier */}
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Change Tier</p>
          <div className="flex gap-2 flex-wrap">
            {TIERS.filter((t) => t !== tier).map((t) => (
              <button
                key={t}
                onClick={() => changeTierMutation.mutate({ newTier: t })}
                disabled={changeTierMutation.isPending}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 capitalize"
              >
                {changeTierMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                {t} (${TIER_LIMITS[t].price}/agent)
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 disabled:opacity-50 text-sm"
          >
            {portalMutation.isPending ? 'Opening...' : 'Manage Billing'}
          </button>
          <button
            onClick={() => {
              if (confirm('Cancel agency billing? All agents will revert to free tier at the end of the billing period.')) {
                disableMutation.mutate()
              }
            }}
            disabled={disableMutation.isPending}
            className="px-4 py-2 border border-destructive text-destructive rounded-lg font-medium hover:bg-destructive/10 disabled:opacity-50 text-sm"
          >
            {disableMutation.isPending ? 'Canceling...' : 'Cancel Agency Billing'}
          </button>
        </div>
      </div>

      {/* Agent List */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h4 className="font-bold text-foreground mb-4">Billed Agents ({dashboard.agents?.length || 0})</h4>
        <div className="space-y-2">
          {dashboard.agents?.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {agent.firstName} {agent.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{agent.email}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded capitalize">
                {agent.subscriptionTier}
              </span>
            </div>
          ))}
          {(!dashboard.agents || dashboard.agents.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No billable agents found</p>
          )}
        </div>
      </div>
    </div>
  )
}
