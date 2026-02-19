'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UpgradePromptProps {
  title?: string;
  message?: string;
  requiredTier?: string;
  blur?: boolean;
}

export function UpgradePrompt({
  title = 'Upgrade to View',
  message = 'Upgrade to Pro or Expert tier to access this feature',
  requiredTier = 'Pro',
  blur = true,
}: UpgradePromptProps) {
  const router = useRouter();

  return (
    <div className="relative min-h-[400px] flex items-center justify-center">
      {/* Blurred background if content exists */}
      {blur && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-md rounded-lg" />
      )}

      {/* Upgrade prompt */}
      <div className="relative z-10 max-w-md mx-auto text-center p-8 bg-card rounded-xl border border-border shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Lock className="w-12 h-12 text-primary" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{message}</p>

        <button
          onClick={() => router.push('/user/profile')}
          className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
        >
          Upgrade to {requiredTier}
        </button>
      </div>
    </div>
  );
}
