'use client';

import { useState } from 'react';

interface SubscriptionCardProps {
  title: string;
  price: number;
  features: string[];
  priceId: string;
  subscriptionType: 'agent_subscription' | 'ai_mode_addon';
  isCurrentPlan?: boolean;
  buttonText?: string;
}

export function SubscriptionCard({
  title,
  price,
  features,
  priceId,
  subscriptionType,
  isCurrentPlan = false,
  buttonText = 'Subscribe',
}: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      setError(null);

      // For AI Mode addon, add to existing subscription instead of creating new one
      if (subscriptionType === 'ai_mode_addon') {
        const response = await fetch('/api/stripe/add-subscription-item', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ priceId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add subscription item');
        }

        // Refresh the page to show updated subscription
        window.location.reload();
        return;
      }

      // For base subscription, create checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          subscriptionType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout URL (modern approach)
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-lg border p-6 ${isCurrentPlan ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-gray-600 dark:text-gray-400">/month</span>
        </div>
      </div>

      <ul className="mb-6 space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <svg
              className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-green-500"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading || isCurrentPlan || buttonText === 'Requires Agent Subscription'}
        className={`w-full rounded-md px-4 py-2 font-medium transition-colors ${
          isCurrentPlan || buttonText === 'Requires Agent Subscription'
            ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
        }`}
      >
        {loading ? 'Loading...' : buttonText}
      </button>
    </div>
  );
}
