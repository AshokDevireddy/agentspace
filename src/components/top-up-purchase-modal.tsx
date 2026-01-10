'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { TOPUP_PRODUCTS, TopupProductKey } from '@/lib/topup-products';
import { useCreateTopUpSession } from '@/hooks/mutations';

interface TopUpPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'messages' | 'ai';
  currentTier: string;
  currentUsage: number;
  limit: number;
  topupCredits: number;
}

export default function TopUpPurchaseModal({
  isOpen,
  onClose,
  type,
  currentTier,
  currentUsage,
  limit,
  topupCredits
}: TopUpPurchaseModalProps) {
  const [error, setError] = useState<string | null>(null);

  // Use TanStack Query mutation for top-up session creation
  const topUpMutation = useCreateTopUpSession({
    onSuccess: (url) => {
      // Redirect to Stripe Checkout
      window.location.href = url;
    },
    onError: (err) => {
      console.error('Error purchasing top-up:', err);
      setError(err.message || 'Failed to purchase top-up');
    },
  });

  // Get available top-up products for this tier
  const availableProducts = Object.entries(TOPUP_PRODUCTS).filter(([_, product]) => {
    if (type === 'messages') {
      return product.type === 'message_topup' && product.requiredTier === currentTier;
    } else {
      return product.type === 'ai_topup' && product.requiredTier === currentTier;
    }
  });

  const handlePurchase = (productKey: TopupProductKey) => {
    setError(null);
    topUpMutation.mutate({ topupProductKey: productKey });
  };

  const getPrice = (productKey: string) => {
    if (productKey.includes('MESSAGE_BASIC')) return '$5';
    if (productKey.includes('MESSAGE_PRO')) return '$5';
    if (productKey.includes('MESSAGE_EXPERT')) return '$10';
    if (productKey.includes('AI')) return '$10';
    return '$0';
  };

  const Icon = type === 'messages' ? MessageSquare : Sparkles;
  const title = type === 'messages' ? 'Purchase Additional Messages' : 'Purchase Additional AI Requests';
  const description = type === 'messages'
    ? `You've used ${currentUsage} of ${limit} messages this month. You have ${topupCredits} top-up credits remaining.`
    : `You've used ${currentUsage} of ${limit} AI requests this month. You have ${topupCredits} top-up credits remaining.`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3 mt-4">
          {availableProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No top-up options available for your current tier.</p>
              <p className="text-sm mt-2">Please upgrade your subscription to access top-ups.</p>
            </div>
          ) : (
            availableProducts.map(([key, product]) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
              >
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{product.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{product.description}</p>
                </div>
                <Button
                  onClick={() => handlePurchase(key as TopupProductKey)}
                  disabled={topUpMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {topUpMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Buy {getPrice(key)}</>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-sm">
          <p className="text-purple-900 dark:text-purple-300">
            <strong>Note:</strong> Top-up credits carry over month-to-month and never expire. They are consumed after your monthly tier allowance is used.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
