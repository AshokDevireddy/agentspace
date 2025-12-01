'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MessageSquare, Sparkles, AlertCircle } from 'lucide-react';

interface UsageDisplayCardProps {
  type: 'messages' | 'ai';
  currentUsage: number;
  limit: number;
  resetDate?: string;
  tier: string;
  overagePrice?: number;
}

export default function UsageDisplayCard({
  type,
  currentUsage,
  limit,
  resetDate,
  tier,
  overagePrice
}: UsageDisplayCardProps) {
  const Icon = type === 'messages' ? MessageSquare : Sparkles;
  const title = type === 'messages' ? 'Messages' : 'AI Requests';
  const description = type === 'messages'
    ? 'Outbound SMS messages sent this month'
    : 'AI Mode requests this month';

  // Calculate overage and percentage
  const overage = Math.max(currentUsage - limit, 0);
  const percentageUsed = Math.min((currentUsage / limit) * 100, 100);
  const remaining = Math.max(limit - currentUsage, 0);
  const isNearLimit = percentageUsed >= 80;
  const isOverLimit = currentUsage > limit;
  const overageCost = overage * (overagePrice || 0);

  const formatResetDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-purple-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Used</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {currentUsage} / {limit} included
            </span>
          </div>
          <Progress
            value={percentageUsed}
            className={`h-2 ${
              isOverLimit
                ? 'bg-red-100 [&>div]:bg-red-600'
                : isNearLimit
                ? 'bg-amber-100 [&>div]:bg-amber-600'
                : 'bg-purple-100 [&>div]:bg-purple-600'
            }`}
          />
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-gray-600 dark:text-gray-400">Included</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{limit}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-600 dark:text-gray-400">Remaining</p>
            <p className={`font-semibold ${
              remaining === 0 ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400'
            }`}>
              {remaining}
            </p>
          </div>
        </div>

        {/* Reset Date */}
        {resetDate && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Resets: {formatResetDate(resetDate)}
          </p>
        )}

        {/* Overage Information */}
        {isOverLimit && overagePrice && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 text-sm border border-amber-200 dark:border-amber-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Overage Usage</p>
                <p className="text-amber-700 dark:text-amber-300">
                  {overage} {title.toLowerCase()} over limit × ${overagePrice.toFixed(2)} = ${overageCost.toFixed(2)}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Will be added to your next invoice
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warning Messages */}
        {!isOverLimit && isNearLimit && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-600 dark:text-amber-400">
            <p className="font-semibold">Running low</p>
            <p>You have {remaining} {title.toLowerCase()} remaining.</p>
            {overagePrice && (
              <p className="text-xs mt-1">Additional usage will be charged at ${overagePrice.toFixed(2)} per {type === 'messages' ? 'message' : 'request'}</p>
            )}
          </div>
        )}

        {tier === 'free' && type === 'messages' && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-600 dark:text-blue-400">
            <p className="font-semibold">Upgrade Required</p>
            <p>SMS messaging requires Basic tier or higher</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
