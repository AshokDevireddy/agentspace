'use client';

import { useMutation } from '@tanstack/react-query';
import { useNotification } from '@/contexts/notification-context'

interface SubscriptionManagerProps {
  subscriptionStatus: string;
  hasAiAddon: boolean;
}

export function SubscriptionManager({ subscriptionStatus, hasAiAddon }: SubscriptionManagerProps) {
  const { showError } = useNotification()

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      console.error('Error opening billing portal:', err);
      showError(err instanceof Error ? err.message : 'An error occurred');
    },
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold">Current Subscription</h3>

      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            subscriptionStatus === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : subscriptionStatus === 'past_due'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              : subscriptionStatus === 'canceled'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {subscriptionStatus === 'active' ? 'Active' :
             subscriptionStatus === 'past_due' ? 'Past Due' :
             subscriptionStatus === 'canceled' ? 'Canceled' : 'Free'}
          </span>
        </div>

        {hasAiAddon && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">AI Mode Add-on:</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              Active
            </span>
          </div>
        )}
      </div>

      {subscriptionStatus !== 'free' && (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full rounded-md bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Loading...' : 'Manage Subscription'}
        </button>
      )}
    </div>
  );
}
