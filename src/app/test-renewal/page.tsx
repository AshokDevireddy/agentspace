'use client';

import { useState } from 'react';

export default function TestRenewalPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulateRenewal = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test/simulate-renewal', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to simulate renewal');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Test Billing Cycle Renewal</h1>

        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">What This Does</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Simulates what happens when your Stripe subscription renews</li>
            <li>Advances billing cycle dates by ~30 days</li>
            <li>Resets usage counters (messages, AI requests)</li>
            <li>Applies any scheduled tier changes (downgrades)</li>
            <li>Updates Stripe subscription to new tier if downgrade was scheduled</li>
          </ul>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            ⚠️ This endpoint only works in development mode
          </p>
        </div>

        <button
          onClick={simulateRenewal}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Simulating Renewal...' : 'Simulate Billing Cycle Renewal'}
        </button>

        {error && (
          <div className="mt-6 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-destructive mb-2">Error</h3>
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4">
              ✅ {result.message}
            </h3>

            {result.details && (
              <div className="space-y-4">
                {/* Old Billing Cycle */}
                <div>
                  <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">Old Billing Cycle</h4>
                  <div className="bg-white dark:bg-gray-900 rounded p-3 space-y-1 font-mono text-sm">
                    <div>
                      <span className="text-muted-foreground">Start:</span>{' '}
                      <span className="text-foreground">
                        {result.details.oldBillingCycle?.start
                          ? new Date(result.details.oldBillingCycle.start).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End:</span>{' '}
                      <span className="text-foreground">
                        {result.details.oldBillingCycle?.end
                          ? new Date(result.details.oldBillingCycle.end).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* New Billing Cycle */}
                <div>
                  <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">New Billing Cycle</h4>
                  <div className="bg-white dark:bg-gray-900 rounded p-3 space-y-1 font-mono text-sm">
                    <div>
                      <span className="text-muted-foreground">Start:</span>{' '}
                      <span className="text-foreground font-semibold">
                        {new Date(result.details.newBillingCycle.start).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End:</span>{' '}
                      <span className="text-foreground font-semibold">
                        {new Date(result.details.newBillingCycle.end).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tier Change */}
                {result.details.tierChange && (
                  <div>
                    <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">
                      Tier Change Applied
                    </h4>
                    <div className="bg-white dark:bg-gray-900 rounded p-3 font-mono text-sm">
                      <span className="text-foreground">{result.details.tierChange.from}</span>
                      <span className="text-muted-foreground mx-2">→</span>
                      <span className="text-foreground font-semibold">{result.details.tierChange.to}</span>
                    </div>
                  </div>
                )}

                {/* Usage Reset */}
                <div>
                  <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">Usage Reset</h4>
                  <div className="bg-white dark:bg-gray-900 rounded p-3 space-y-1 font-mono text-sm">
                    <div>
                      <span className="text-muted-foreground">Messages:</span>{' '}
                      <span className="text-foreground">{result.details.usageReset.messages}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">AI Requests:</span>{' '}
                      <span className="text-foreground">{result.details.usageReset.aiRequests}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-green-200 dark:border-green-800">
              <a
                href="/user/profile"
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Go to Profile to See Changes
              </a>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-muted rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">How to Test Scheduled Downgrade</h3>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Go to your profile page and schedule a downgrade (e.g., Expert → Basic)</li>
            <li>Come back to this page and click "Simulate Billing Cycle Renewal"</li>
            <li>Check that your tier changed to the scheduled tier</li>
            <li>Verify in Stripe Dashboard that subscription price updated</li>
          </ol>
        </div>

        {/* Raw Response */}
        {result && (
          <details className="mt-6">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show Raw Response
            </summary>
            <pre className="mt-2 bg-muted rounded p-4 overflow-x-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
