// Subscription tier configuration
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  EXPERT: 'expert',
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

// Tier limits configuration
export const TIER_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE]: {
    name: 'Free',
    price: 0,
    deals: 10,
    messages: 0, // No SMS access - blocked completely
    aiRequests: 0, // No AI access
    analyticsAccess: false,
    expectedPayoutsAccess: false,
    downlineDataAccess: false,
    autoMessaging: false,
    adminOnly: false,
    smsBlocked: true, // NEW: Block SMS completely
    features: [
      '10 deal limit',
      'No SMS/messaging access',
      'Upgrade to send messages',
      'No analytics or AI mode',
      'No downline data access',
    ],
  },
  [SUBSCRIPTION_TIERS.BASIC]: {
    name: 'Basic',
    price: 20,
    deals: Infinity, // Unlimited
    messages: 50,
    overagePrice: 0.10, // $0.10 per additional message
    aiRequests: 0, // No AI access
    analyticsAccess: false,
    expectedPayoutsAccess: true,
    downlineDataAccess: false,
    autoMessaging: false,
    adminOnly: false,
    features: [
      'Unlimited deal creation',
      '50 messages/month included',
      '$0.10 per additional message',
      'View expected payouts',
      'No analytics or AI mode',
    ],
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    name: 'Pro',
    price: 60,
    deals: Infinity, // Unlimited
    messages: 200,
    overagePrice: 0.08, // $0.08 per additional message
    aiRequests: 0, // No AI access (AI mode is Expert only)
    analyticsAccess: true,
    expectedPayoutsAccess: true,
    downlineDataAccess: true,
    autoMessaging: true, // AI-powered client retention
    adminOnly: false,
    features: [
      'Everything in Basic',
      '200 messages/month included',
      '$0.08 per additional message',
      'Full analytics dashboard',
      'View downline data',
      'AI-powered client retention',
    ],
  },
  [SUBSCRIPTION_TIERS.EXPERT]: {
    name: 'Expert',
    price: 150,
    deals: Infinity, // Unlimited
    messages: 1000,
    overagePrice: 0.05, // $0.05 per additional message
    aiRequests: 50,
    aiOveragePrice: 0.25, // $0.25 per additional AI request
    analyticsAccess: true,
    expectedPayoutsAccess: true,
    downlineDataAccess: true,
    autoMessaging: true,
    policyReportUploads: true,
    adminOnly: false, // Anyone can subscribe, but some features are admin-only
    aiModeAdminOnly: true, // AI Mode is admin-only
    policyReportUploadsAdminOnly: true, // Policy report uploads are admin-only
    features: [
      'Everything in Pro',
      '1,000 messages/month included',
      '$0.05 per additional message',
      'AI Mode: 50 requests/month',
      '$0.25 per additional AI request',
      'Policy report uploads',
      'AI Mode & Report Uploads are Admin users only',
    ],
  },
} as const;

// Helper function to get tier limits
export function getTierLimits(tier: string) {
  const normalizedTier = tier as SubscriptionTier;
  return TIER_LIMITS[normalizedTier] || TIER_LIMITS[SUBSCRIPTION_TIERS.FREE];
}

// Helper function to check if user can perform action
export function canPerformAction(
  tier: string,
  action: 'deals' | 'messages' | 'aiRequests' | 'analytics' | 'expectedPayouts' | 'downlineData' | 'autoMessaging',
  currentCount: number
): boolean {
  const limits = getTierLimits(tier);

  switch (action) {
    case 'deals':
      return currentCount < limits.deals;
    case 'messages':
      return currentCount < limits.messages;
    case 'aiRequests':
      return currentCount < limits.aiRequests;
    case 'analytics':
      return limits.analyticsAccess;
    case 'expectedPayouts':
      return limits.expectedPayoutsAccess;
    case 'downlineData':
      return limits.downlineDataAccess;
    case 'autoMessaging':
      return limits.autoMessaging;
    default:
      return false;
  }
}

// Check if user can access a specific tier (Expert is admin-only)
export function canAccessTier(tier: SubscriptionTier, isAdmin: boolean): boolean {
  const limits = getTierLimits(tier);
  return !limits.adminOnly || isAdmin;
}

// Stripe Price IDs mapping
export const TIER_PRICE_IDS = {
  [SUBSCRIPTION_TIERS.BASIC]: process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || '',
  [SUBSCRIPTION_TIERS.PRO]: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
  [SUBSCRIPTION_TIERS.EXPERT]: process.env.NEXT_PUBLIC_STRIPE_EXPERT_PRICE_ID || '',
} as const;

// Get tier from price ID
export function getTierFromPriceId(priceId: string): SubscriptionTier {
  const entry = Object.entries(TIER_PRICE_IDS).find(([_, id]) => id === priceId);
  return (entry?.[0] as SubscriptionTier) || SUBSCRIPTION_TIERS.FREE;
}

// Get price ID from tier
export function getPriceIdFromTier(tier: SubscriptionTier): string {
  return TIER_PRICE_IDS[tier] || '';
}
