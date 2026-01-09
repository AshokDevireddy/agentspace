"use client"

import React, { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { PricingTierCard } from "@/components/pricing-tier-card";
import { SubscriptionManager } from "@/components/subscription-manager";
import { TIER_LIMITS, TIER_PRICE_IDS } from "@/lib/subscription-tiers";
import { useNotification } from '@/contexts/notification-context'
import { useTheme } from "next-themes"
import { updateUserTheme, ThemeMode } from "@/lib/theme"
import { Sun, Moon, Monitor, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApiFetch } from '@/hooks/useApiFetch'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  createdAt: string;
  is_admin: boolean;
  role: string;
  position_id: string | null;
  position: {
    id: string;
    name: string;
    level: number;
  } | null;
  subscription_status?: string;
  subscription_tier?: string;
  deals_created_count?: number;
  ai_requests_count?: number;
  messages_sent_count?: number;
  billing_cycle_start?: string | null;
  billing_cycle_end?: string | null;
  scheduled_tier_change?: string | null;
  scheduled_tier_change_date?: string | null;
}

interface Position {
  position_id: string;
  name: string;
  level: number;
  description: string | null;
  is_active: boolean;
}

interface ProfileApiResponse {
  success: boolean;
  data: ProfileData;
}

// Helper function to format date as "Month DD, YYYY"
const formatRenewalDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Not available';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function ProfilePage() {
  const { user, userData, refreshUserData, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useNotification()
  const { setTheme } = useTheme()
  const queryClient = useQueryClient()
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [savingTheme, setSavingTheme] = useState(false);

  // Fetch user profile data using TanStack Query
  const {
    data: profileResponse,
    isLoading: profileLoading,
    error: profileError
  } = useApiFetch<ProfileApiResponse>(
    queryKeys.userProfile(user?.id),
    `/api/user/profile?user_id=${user?.id}`,
    {
      enabled: !!user,
      staleTime: 5 * 60 * 1000, // 5 minutes - profile rarely changes
      placeholderData: (previousData) => previousData, // Stale-while-revalidate
    }
  )

  const profileData = profileResponse?.data

  // Update selectedPositionId when profileData changes
  React.useEffect(() => {
    if (profileData?.position_id) {
      setSelectedPositionId(profileData.position_id)
    }
  }, [profileData?.position_id])

  // Fetch positions if admin using TanStack Query with custom queryFn
  const {
    data: positions = [],
    isLoading: positionsLoading
  } = useQuery<Position[]>({
    queryKey: queryKeys.positionsList(),
    queryFn: async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/positions', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.status}`);
      }

      return response.json();
    },
    enabled: !!profileData?.is_admin
  })

  // Handle position update with mutation
  const updatePositionMutation = useMutation({
    mutationFn: async (positionId: string) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ position_id: positionId }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update position');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(user?.id) })
      showSuccess('Position updated successfully!');
    },
    onError: (error: Error) => {
      console.error('Error updating position:', error);
      showError('Failed to update position: ' + error.message);
    }
  })

  const handlePositionUpdate = () => {
    if (!selectedPositionId) return;
    updatePositionMutation.mutate(selectedPositionId);
  };

  const handleThemeChange = async (newTheme: ThemeMode) => {
    setSavingTheme(true)
    setTheme(newTheme)
    const result = await updateUserTheme(newTheme)
    if (result.success) {
      await refreshUserData()
    } else {
      showError('Failed to update theme preference')
    }
    setSavingTheme(false)
  }

  // Show error state if profile fetch failed
  if (profileError) {
    return (
      <div className="flex flex-col items-center w-full min-h-screen bg-background py-8">
        <div className="w-full max-w-3xl bg-destructive/10 rounded-xl border border-destructive p-6">
          <h2 className="text-lg font-semibold text-destructive mb-2">Failed to load profile</h2>
          <p className="text-sm text-destructive/80">{profileError instanceof Error ? profileError.message : 'An unexpected error occurred'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show loading skeleton until data is ready
  if (authLoading || profileLoading || !profileData) {
    return (
      <div className="flex flex-col items-center w-full min-h-screen bg-background py-8 animate-pulse">
        <div className="w-full max-w-3xl bg-card rounded-2xl shadow-md p-8 mb-8 border border-border">
          <div className="flex items-center">
            <div className="w-32 h-32 bg-muted rounded-lg mr-8" />
            <div className="space-y-3">
              <div className="h-10 w-64 bg-muted rounded" />
              <div className="h-4 w-48 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prepare user object with API data
  const user_profile = {
    name: profileData.fullName,
    avatarUrl: "", // Keep as empty for now
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-background py-8">
      {/* Profile Card */}
      <div className="w-full max-w-3xl bg-card rounded-2xl shadow-md p-8 mb-8 border border-border">
        <div className="flex items-center">
          {/* Avatar */}
          <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center mr-8 shadow">
            {/* Show avatar if available, else fallback */}
            {user_profile.avatarUrl ? (
              <img src={user_profile.avatarUrl} alt="Profile" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <svg className="w-20 h-20 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="5" />
                <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
              </svg>
            )}
          </div>
          {/* Info */}
          <div>
            <h1 className="text-4xl font-extrabold text-foreground mb-1">{user_profile.name}</h1>
          </div>
        </div>
      </div>

      {/* Position Selection (Admin Only) */}
      {profileData.is_admin && (
        <div className="w-full max-w-3xl bg-card rounded-2xl shadow border border-border p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Position</h2>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Current Position: {profileData.position?.name || 'Not Set'}
              </label>
              <select
                value={selectedPositionId}
                onChange={(e) => setSelectedPositionId(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Position</option>
                {positions.map((position) => (
                  <option key={position.position_id} value={position.position_id}>
                    {position.name} (Level {position.level})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePositionUpdate}
              disabled={updatePositionMutation.isPending || !selectedPositionId || selectedPositionId === profileData.position_id}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatePositionMutation.isPending ? 'Updating...' : 'Update Position'}
            </button>
          </div>
        </div>
      )}

      {/* Theme Preference (Non-admin agents only - Admins use Settings page) */}
      {!profileData.is_admin && userData?.role === 'agent' && (
        <div className="w-full max-w-3xl bg-card rounded-2xl shadow border border-border p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground mb-2">
            <Moon className="h-5 w-5 inline mr-2" />
            Theme Preference
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Choose your personal theme preference. This setting only affects your account.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Light Theme Option */}
            <button
              onClick={() => handleThemeChange('light')}
              disabled={savingTheme}
              className={cn(
                "relative p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                (userData?.theme_mode || 'system') === 'light'
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50 shadow-lg"
                  : "border-border bg-card hover:border-blue-300 dark:hover:border-blue-600"
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <Sun className={cn(
                  "h-10 w-10",
                  (userData?.theme_mode || 'system') === 'light' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                )} />
                <div className="text-center">
                  <p className={cn(
                    "font-semibold text-lg",
                    (userData?.theme_mode || 'system') === 'light' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                  )}>
                    Light
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bright, clean interface
                  </p>
                </div>
                {(userData?.theme_mode || 'system') === 'light' && (
                  <div className="absolute top-3 right-3">
                    <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
            </button>

            {/* Dark Theme Option */}
            <button
              onClick={() => handleThemeChange('dark')}
              disabled={savingTheme}
              className={cn(
                "relative p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                (userData?.theme_mode || 'system') === 'dark'
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50 shadow-lg"
                  : "border-border bg-card hover:border-blue-300 dark:hover:border-blue-600"
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <Moon className={cn(
                  "h-10 w-10",
                  (userData?.theme_mode || 'system') === 'dark' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                )} />
                <div className="text-center">
                  <p className={cn(
                    "font-semibold text-lg",
                    (userData?.theme_mode || 'system') === 'dark' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                  )}>
                    Dark
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Easy on the eyes
                  </p>
                </div>
                {(userData?.theme_mode || 'system') === 'dark' && (
                  <div className="absolute top-3 right-3">
                    <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
            </button>

            {/* System Theme Option */}
            <button
              onClick={() => handleThemeChange('system')}
              disabled={savingTheme}
              className={cn(
                "relative p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                (userData?.theme_mode || 'system') === 'system'
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50 shadow-lg"
                  : "border-border bg-card hover:border-blue-300 dark:hover:border-blue-600"
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <Monitor className={cn(
                  "h-10 w-10",
                  (userData?.theme_mode || 'system') === 'system' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                )} />
                <div className="text-center">
                  <p className={cn(
                    "font-semibold text-lg",
                    (userData?.theme_mode || 'system') === 'system' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                  )}>
                    System
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Follow device settings
                  </p>
                </div>
                {(userData?.theme_mode || 'system') === 'system' && (
                  <div className="absolute top-3 right-3">
                    <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
            </button>
          </div>

          {savingTheme && (
            <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving theme preference...
            </div>
          )}
        </div>
      )}

      {/* Subscription Section */}
      <div className="w-full max-w-7xl mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2 text-center">Choose Your Plan</h2>
        <p className="text-muted-foreground text-center mb-8">Select the perfect tier for your needs</p>

        {/* Current Subscription Status */}
        {profileData.subscription_tier && profileData.subscription_tier !== 'free' && (
          <div className="mb-8">
            <SubscriptionManager
              subscriptionStatus={profileData.subscription_status || 'active'}
              hasAiAddon={false}
            />

            {/* Billing Cycle Information */}
            {profileData.billing_cycle_end && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Next Billing Date</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatRenewalDate(profileData.billing_cycle_end)}
                    </p>
                  </div>

                  {/* Show scheduled tier change if any */}
                  {profileData.scheduled_tier_change && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Scheduled Change
                      </p>
                      <p className="text-base font-semibold text-amber-700 dark:text-amber-300 capitalize">
                        → {profileData.scheduled_tier_change} Tier
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Usage Stats */}
        {profileData.subscription_tier === 'free' && (
          <div className="mb-8 rounded-xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 dark:border-yellow-700 p-6">
            <h3 className="font-bold text-yellow-900 dark:text-yellow-200 mb-3 text-lg">Free Tier Usage</h3>
            <div className="grid gap-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-yellow-800 dark:text-yellow-300">Deals Created</span>
                  <span className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    {profileData.deals_created_count || 0} / 10
                  </span>
                </div>
                <div className="w-full bg-yellow-200 dark:bg-yellow-900/30 rounded-full h-2">
                  <div
                    className="bg-yellow-600 dark:bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(((profileData.deals_created_count || 0) / 10) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-yellow-800 dark:text-yellow-300">Messages Sent</span>
                  <span className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    {profileData.messages_sent_count || 0} / 10
                  </span>
                </div>
                <div className="w-full bg-yellow-200 dark:bg-yellow-900/30 rounded-full h-2">
                  <div
                    className="bg-yellow-600 dark:bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(((profileData.messages_sent_count || 0) / 10) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            {((profileData.deals_created_count || 0) >= 10 || (profileData.messages_sent_count || 0) >= 10) && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-4">
                ⚠️ You've reached your limits. Upgrade to unlock more!
              </p>
            )}
          </div>
        )}

        {/* Pricing Tiers Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Free Tier */}
          <PricingTierCard
            tier="free"
            name={TIER_LIMITS.free.name}
            price={TIER_LIMITS.free.price}
            features={TIER_LIMITS.free.features}
            priceId=""
            isCurrentPlan={profileData.subscription_tier === 'free'}
            currentTier={(profileData.subscription_tier as 'free' | 'basic' | 'pro' | 'expert') || 'free'}
            hasActiveSubscription={profileData.subscription_status === 'active' && profileData.subscription_tier !== 'free'}
          />

          {/* Basic Tier */}
          <PricingTierCard
            tier="basic"
            name={TIER_LIMITS.basic.name}
            price={TIER_LIMITS.basic.price}
            features={TIER_LIMITS.basic.features}
            priceId={TIER_PRICE_IDS.basic}
            isCurrentPlan={profileData.subscription_tier === 'basic'}
            currentTier={(profileData.subscription_tier as 'free' | 'basic' | 'pro' | 'expert') || 'free'}
            hasActiveSubscription={profileData.subscription_status === 'active' && profileData.subscription_tier !== 'free'}
          />

          {/* Pro Tier */}
          <PricingTierCard
            tier="pro"
            name={TIER_LIMITS.pro.name}
            price={TIER_LIMITS.pro.price}
            features={TIER_LIMITS.pro.features}
            priceId={TIER_PRICE_IDS.pro}
            isCurrentPlan={profileData.subscription_tier === 'pro'}
            recommended={true}
            currentTier={(profileData.subscription_tier as 'free' | 'basic' | 'pro' | 'expert') || 'free'}
            hasActiveSubscription={profileData.subscription_status === 'active' && profileData.subscription_tier !== 'free'}
          />

          {/* Expert Tier */}
          <PricingTierCard
            tier="expert"
            name={TIER_LIMITS.expert.name}
            price={TIER_LIMITS.expert.price}
            features={TIER_LIMITS.expert.features}
            priceId={TIER_PRICE_IDS.expert}
            isCurrentPlan={profileData.subscription_tier === 'expert'}
            currentTier={(profileData.subscription_tier as 'free' | 'basic' | 'pro' | 'expert') || 'free'}
            hasActiveSubscription={profileData.subscription_status === 'active' && profileData.subscription_tier !== 'free'}
          />
        </div>

        {/* Basic Tier Usage */}
        {profileData.subscription_tier === 'basic' && (() => {
          const msgUsage = profileData.messages_sent_count || 0;
          const msgLimit = 50;
          const msgOverage = Math.max(msgUsage - msgLimit, 0);
          const msgPercentage = Math.min((msgUsage / msgLimit) * 100, 100);
          const msgOverageCost = msgOverage * 0.10;

          return (
            <div className="mt-8 rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 dark:border-blue-700 p-6">
              <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-3 text-lg flex items-center gap-2">
                <span>Basic Tier Usage This Month</span>
              </h3>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-blue-800 dark:text-blue-300">Messages Sent</span>
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    {msgUsage} / {msgLimit} included
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900/30 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${msgPercentage}%` }}
                  />
                </div>
                {msgOverage > 0 && (
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Overage: {msgOverage} messages × $0.10 = ${msgOverageCost.toFixed(2)}
                  </p>
                )}
              </div>
              {msgOverageCost > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-300 dark:border-blue-700">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    Estimated overage charges this month: ${msgOverageCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Will be added to your next invoice
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Pro Tier Usage */}
        {profileData.subscription_tier === 'pro' && (() => {
          const msgUsage = profileData.messages_sent_count || 0;
          const msgLimit = 200;
          const msgOverage = Math.max(msgUsage - msgLimit, 0);
          const msgPercentage = Math.min((msgUsage / msgLimit) * 100, 100);
          const msgOverageCost = msgOverage * 0.08;

          return (
            <div className="mt-8 rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-700 p-6">
              <h3 className="font-bold text-purple-900 dark:text-purple-200 mb-3 text-lg flex items-center gap-2">
                <span>Pro Tier Usage This Month</span>
              </h3>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-purple-800 dark:text-purple-300">Messages Sent</span>
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-200">
                    {msgUsage} / {msgLimit} included
                  </span>
                </div>
                <div className="w-full bg-purple-200 dark:bg-purple-900/30 rounded-full h-2">
                  <div
                    className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${msgPercentage}%` }}
                  />
                </div>
                {msgOverage > 0 && (
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                    Overage: {msgOverage} messages × $0.08 = ${msgOverageCost.toFixed(2)}
                  </p>
                )}
              </div>
              {msgOverageCost > 0 && (
                <div className="mt-4 pt-4 border-t border-purple-300 dark:border-purple-700">
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                    Estimated overage charges this month: ${msgOverageCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                    Will be added to your next invoice
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Expert Tier Usage (for all Expert tier users) */}
        {profileData.subscription_tier === 'expert' && (() => {
          const msgUsage = profileData.messages_sent_count || 0;
          const msgLimit = 1000;
          const msgOverage = Math.max(msgUsage - msgLimit, 0);
          const msgPercentage = Math.min((msgUsage / msgLimit) * 100, 100);
          const msgOverageCost = msgOverage * 0.05;

          // Admin users see both AI and messages
          if (profileData.is_admin) {
            const aiUsage = profileData.ai_requests_count || 0;
            const aiLimit = 50;
            const aiOverage = Math.max(aiUsage - aiLimit, 0);
            const aiPercentage = Math.min((aiUsage / aiLimit) * 100, 100);
            const aiOverageCost = aiOverage * 0.25;
            const totalOverageCost = aiOverageCost + msgOverageCost;

            return (
              <div className="mt-8 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-700 p-6">
                <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-3 text-lg flex items-center gap-2">
                  <span>Expert Tier Usage This Month</span>
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-amber-800 dark:text-amber-300">AI Requests</span>
                      <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        {aiUsage} / {aiLimit} included
                      </span>
                    </div>
                    <div className="w-full bg-amber-200 dark:bg-amber-900/30 rounded-full h-2">
                      <div
                        className="bg-amber-600 dark:bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${aiPercentage}%` }}
                      />
                    </div>
                    {aiOverage > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Overage: {aiOverage} requests × $0.25 = ${aiOverageCost.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-amber-800 dark:text-amber-300">Messages Sent</span>
                      <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        {msgUsage} / {msgLimit} included
                      </span>
                    </div>
                    <div className="w-full bg-amber-200 dark:bg-amber-900/30 rounded-full h-2">
                      <div
                        className="bg-amber-600 dark:bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${msgPercentage}%` }}
                      />
                    </div>
                    {msgOverage > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Overage: {msgOverage} messages × $0.05 = ${msgOverageCost.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                {totalOverageCost > 0 && (
                  <div className="mt-4 pt-4 border-t border-amber-300 dark:border-amber-700">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Estimated overage charges this month: ${totalOverageCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Will be added to your next invoice
                    </p>
                  </div>
                )}
              </div>
            );
          }

          // Non-admin users see only messages
          return (
            <div className="mt-8 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-700 p-6">
              <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-3 text-lg flex items-center gap-2">
                <span>Expert Tier Usage This Month</span>
              </h3>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-amber-800 dark:text-amber-300">Messages Sent</span>
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {msgUsage} / {msgLimit} included
                  </span>
                </div>
                <div className="w-full bg-amber-200 dark:bg-amber-900/30 rounded-full h-2">
                  <div
                    className="bg-amber-600 dark:bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${msgPercentage}%` }}
                  />
                </div>
                {msgOverage > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Overage: {msgOverage} messages × $0.05 = ${msgOverageCost.toFixed(2)}
                  </p>
                )}
              </div>
              {msgOverageCost > 0 && (
                <div className="mt-4 pt-4 border-t border-amber-300 dark:border-amber-700">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Estimated overage charges this month: ${msgOverageCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Will be added to your next invoice
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
