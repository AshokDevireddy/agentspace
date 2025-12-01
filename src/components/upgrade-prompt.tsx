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
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-md rounded-lg" />
      )}

      {/* Upgrade prompt */}
      <div className="relative z-10 max-w-md mx-auto text-center p-8 bg-gray-800/90 rounded-xl border-2 border-purple-500/50 shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full">
            <Lock className="w-12 h-12 text-purple-400" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-300 mb-6">{message}</p>

        <button
          onClick={() => router.push('/user/profile')}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
        >
          Upgrade to {requiredTier}
        </button>
      </div>
    </div>
  );
}
