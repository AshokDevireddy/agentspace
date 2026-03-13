"use client"

import { Building2, Shield } from "lucide-react"
import { getTierLimits } from "@/lib/subscription-tiers"

interface AgencyManagedBannerProps {
  tier: string | null | undefined
}

export function AgencyManagedBanner({ tier }: AgencyManagedBannerProps) {
  const activeTier = tier || 'free'
  const limits = getTierLimits(activeTier)

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Agency-Managed Plan
            </h3>
            <p className="text-sm text-muted-foreground">
              Your <span className="font-semibold capitalize text-blue-600 dark:text-blue-400">{limits.name}</span> plan is managed by your agency
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Your Plan Features
          </h4>
          {limits.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-sm text-foreground">{feature}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-800">
          <p className="text-sm text-muted-foreground">
            Contact your agency admin to change plans or manage billing.
          </p>
        </div>
      </div>
    </div>
  )
}
