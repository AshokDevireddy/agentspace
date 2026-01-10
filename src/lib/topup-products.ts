// Define top-up products
// These Price IDs need to be created in Stripe Dashboard
export const TOPUP_PRODUCTS = {
  // Basic tier: $5 per 50 messages
  MESSAGE_BASIC_50: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_MESSAGE_BASIC_50_PRICE_ID || '',
    quantity: 50,
    price: 500, // $5.00 in cents
    displayPrice: '$5',
    type: 'message_topup' as const,
    requiredTier: 'basic',
    name: '50 Messages',
    description: 'Add 50 outbound messages to your account',
  },
  // Pro tier: $5 per 100 messages
  MESSAGE_PRO_100: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_MESSAGE_PRO_100_PRICE_ID || '',
    quantity: 100,
    price: 500, // $5.00 in cents
    displayPrice: '$5',
    type: 'message_topup' as const,
    requiredTier: 'pro',
    name: '100 Messages',
    description: 'Add 100 outbound messages to your account',
  },
  // Expert tier: $10 per 500 messages
  MESSAGE_EXPERT_500: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_MESSAGE_EXPERT_500_PRICE_ID || '',
    quantity: 500,
    price: 1000, // $10.00 in cents
    displayPrice: '$10',
    type: 'message_topup' as const,
    requiredTier: 'expert',
    name: '500 Messages',
    description: 'Add 500 outbound messages to your account',
  },
  // Expert tier: $10 per 50 AI requests
  AI_EXPERT_50: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_AI_EXPERT_50_PRICE_ID || '',
    quantity: 50,
    price: 1000, // $10.00 in cents
    displayPrice: '$10',
    type: 'ai_topup' as const,
    requiredTier: 'expert',
    name: '50 AI Requests',
    description: 'Add 50 AI Mode requests to your account',
  },
} as const;

export type TopupProductKey = keyof typeof TOPUP_PRODUCTS;
