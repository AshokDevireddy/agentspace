import { getTierLimits } from '@/lib/subscription-tiers'

type Tier = 'basic' | 'pro' | 'expert'

interface TierUsageCardProps {
  tier: Tier
  messagesSentCount: number
  aiRequestsCount: number
  isAdmin: boolean
  className?: string
}

interface TierColorConfig {
  border: string
  gradient: string
  text: string
  label: string
  trackBg: string
  trackFill: string
  overageText: string
}

const TIER_USAGE_COLORS: Record<Tier, TierColorConfig> = {
  basic: {
    border: 'border-blue-300 dark:border-blue-700',
    gradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
    text: 'text-blue-900 dark:text-blue-200',
    label: 'text-blue-800 dark:text-blue-300',
    trackBg: 'bg-blue-200 dark:bg-blue-900/30',
    trackFill: 'bg-blue-600 dark:bg-blue-500',
    overageText: 'text-blue-700 dark:text-blue-400',
  },
  pro: {
    border: 'border-purple-300 dark:border-purple-700',
    gradient: 'from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20',
    text: 'text-purple-900 dark:text-purple-200',
    label: 'text-purple-800 dark:text-purple-300',
    trackBg: 'bg-purple-200 dark:bg-purple-900/30',
    trackFill: 'bg-purple-600 dark:bg-purple-500',
    overageText: 'text-purple-700 dark:text-purple-400',
  },
  expert: {
    border: 'border-amber-300 dark:border-amber-700',
    gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
    text: 'text-amber-900 dark:text-amber-200',
    label: 'text-amber-800 dark:text-amber-300',
    trackBg: 'bg-amber-200 dark:bg-amber-900/30',
    trackFill: 'bg-amber-600 dark:bg-amber-500',
    overageText: 'text-amber-700 dark:text-amber-400',
  },
}

function UsageMetric({
  label,
  usage,
  limit,
  overagePrice,
  colors,
}: {
  label: string
  usage: number
  limit: number
  overagePrice: number
  colors: TierColorConfig
}) {
  const overage = Math.max(usage - limit, 0)
  const percentage = Math.min((usage / limit) * 100, 100)
  const overageCost = overage * overagePrice

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className={`text-sm ${colors.label}`}>{label}</span>
        <span className={`text-sm font-medium ${colors.text}`}>
          {usage} / {limit} included
        </span>
      </div>
      <div className={`w-full ${colors.trackBg} rounded-full h-2`}>
        <div
          className={`${colors.trackFill} h-2 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {overage > 0 && (
        <p className={`text-xs ${colors.overageText} mt-1`}>
          Overage: {overage} {label.toLowerCase()} &times; ${overagePrice.toFixed(2)} = ${overageCost.toFixed(2)}
        </p>
      )}
    </div>
  )
}

export function TierUsageCard({
  tier,
  messagesSentCount,
  aiRequestsCount,
  isAdmin,
  className,
}: TierUsageCardProps) {
  const limits = getTierLimits(tier)
  const colors = TIER_USAGE_COLORS[tier]
  const tierName = limits.name

  const overagePrice = 'overagePrice' in limits ? limits.overagePrice : 0
  const msgOverage = Math.max(messagesSentCount - limits.messages, 0)
  const msgOverageCost = msgOverage * overagePrice

  const showAi = tier === 'expert' && isAdmin && 'aiOveragePrice' in limits
  const aiOveragePrice = 'aiOveragePrice' in limits ? limits.aiOveragePrice : 0
  const aiOverage = showAi ? Math.max(aiRequestsCount - limits.aiRequests, 0) : 0
  const aiOverageCost = aiOverage * aiOveragePrice
  const totalOverageCost = msgOverageCost + aiOverageCost

  return (
    <div className={`mt-8 rounded-xl border-2 ${colors.border} bg-gradient-to-br ${colors.gradient} p-6 ${className || ''}`}>
      <h3 className={`font-bold ${colors.text} mb-3 text-lg`}>
        {tierName} Tier Usage This Month
      </h3>

      {showAi ? (
        <div className="grid gap-4 md:grid-cols-2">
          <UsageMetric
            label="AI Requests"
            usage={aiRequestsCount}
            limit={limits.aiRequests}
            overagePrice={aiOveragePrice}
            colors={colors}
          />
          <UsageMetric
            label="Messages Sent"
            usage={messagesSentCount}
            limit={limits.messages}
            overagePrice={overagePrice}
            colors={colors}
          />
        </div>
      ) : (
        <UsageMetric
          label="Messages Sent"
          usage={messagesSentCount}
          limit={limits.messages}
          overagePrice={overagePrice}
          colors={colors}
        />
      )}

      {totalOverageCost > 0 && (
        <div className={`mt-4 pt-4 border-t ${colors.border}`}>
          <p className={`text-sm font-semibold ${colors.text}`}>
            Estimated overage charges this month: ${totalOverageCost.toFixed(2)}
          </p>
          <p className={`text-xs ${colors.overageText} mt-1`}>
            Will be added to your next invoice
          </p>
        </div>
      )}
    </div>
  )
}
