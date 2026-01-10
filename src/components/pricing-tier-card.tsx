'use client';

import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import { useNotification } from '@/contexts/notification-context';
import { useSubscription } from '@/hooks/mutations';

interface PricingTierCardProps {
  tier: 'free' | 'basic' | 'pro' | 'expert';
  name: string;
  price: number;
  features: readonly string[];
  priceId: string;
  isCurrentPlan: boolean;
  recommended?: boolean;
  currentTier: 'free' | 'basic' | 'pro' | 'expert';
  hasActiveSubscription: boolean;
}

const tierIcons = {
  free: null,
  basic: <Zap className="w-5 h-5" />,
  pro: <Sparkles className="w-5 h-5" />,
  expert: <Crown className="w-5 h-5" />,
};

const tierColors = {
  free: {
    border: 'border-gray-300 dark:border-gray-600',
    bg: 'bg-white dark:bg-gray-800',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    button: 'bg-gray-600 hover:bg-gray-700 text-white',
    gradient: '',
  },
  basic: {
    border: 'border-blue-300 dark:border-blue-700',
    bg: 'bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-800',
    badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    gradient: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  },
  pro: {
    border: 'border-purple-300 dark:border-purple-700',
    bg: 'bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-800',
    badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    button: 'bg-purple-600 hover:bg-purple-700 text-white',
    gradient: 'bg-gradient-to-r from-purple-500 to-pink-500',
  },
  expert: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-800',
    badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
    button: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white',
    gradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
};

export function PricingTierCard({
  tier,
  name,
  price,
  features,
  priceId,
  isCurrentPlan,
  recommended = false,
  currentTier,
  hasActiveSubscription,
}: PricingTierCardProps) {
  const { showSuccess, showError } = useNotification();

  const colors = tierColors[tier];
  const icon = tierIcons[tier];

  // Use centralized subscription mutation hook
  // Note: hasActiveSubscription and currentTier are passed in mutate() call to avoid stale closures
  const subscriptionMutation = useSubscription({
    onCheckoutRedirect: (url) => {
      window.location.href = url;
    },
    onSubscriptionChanged: (data, newTier) => {
      if (!data.immediate) {
        showSuccess(`Downgrade scheduled! Your plan will change to ${newTier} on ${new Date(data.effectiveDate!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);
      } else {
        showSuccess(`Successfully upgraded to ${newTier} tier!`);
      }
    },
    onError: (err) => {
      console.error('Subscription error:', err);
      showError(err.message || 'Failed to update subscription');
    },
  });

  const handleSubscribe = () => {
    if (tier === 'free') return;
    // Pass current subscription state at call time to avoid stale closures
    subscriptionMutation.mutate({ tier, priceId, hasActiveSubscription, currentTier });
  };

  // All tiers are accessible for subscription (Expert features may be admin-only, not the subscription)
  const isDisabled = subscriptionMutation.isPending || isCurrentPlan || tier === 'free';

  return (
    <div className={`relative flex flex-col rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 shadow-lg transition-all hover:shadow-xl ${recommended ? 'scale-105 ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
      {/* Recommended Badge */}
      {recommended && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1 text-xs font-bold text-white shadow-lg">
            RECOMMENDED
          </div>
        </div>
      )}

      {/* Tier Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {icon && (
            <div className={`flex items-center justify-center rounded-lg ${colors.badge} p-2`}>
              {icon}
            </div>
          )}
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{name}</h3>
        </div>

        {/* Price */}
        <div className="mt-4">
          <div className="flex items-baseline">
            <span className="text-5xl font-extrabold text-gray-900 dark:text-white">${price}</span>
            {price > 0 && (
              <span className="ml-2 text-gray-600 dark:text-gray-400">/month</span>
            )}
          </div>
        </div>
      </div>

      {/* Features List */}
      <ul className="flex-1 space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <div className="mt-1 flex-shrink-0">
              <div className={`rounded-full ${colors.gradient} p-1`}>
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Error Message */}
      {subscriptionMutation.error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {subscriptionMutation.error.message}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={handleSubscribe}
        disabled={isDisabled}
        className={`w-full rounded-lg px-6 py-3 font-semibold transition-all ${
          isCurrentPlan
            ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            : tier === 'free'
            ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            : colors.button
        } disabled:opacity-50`}
      >
        {subscriptionMutation.isPending ? (
          'Loading...'
        ) : isCurrentPlan ? (
          'Current Plan'
        ) : tier === 'free' ? (
          'Free Tier'
        ) : (
          `Select Plan`
        )}
      </button>
    </div>
  );
}
