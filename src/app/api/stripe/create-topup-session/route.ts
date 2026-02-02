import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/session';
import { getBackendUrl } from '@/lib/api-config';
import { stripe } from '@/lib/stripe';
import { TOPUP_PRODUCTS, TopupProductKey } from '@/lib/topup-products';

export async function POST(request: NextRequest) {
  try {
    // Get access token from Django session
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { topupProductKey } = body as { topupProductKey: TopupProductKey };

    if (!topupProductKey || !(topupProductKey in TOPUP_PRODUCTS)) {
      return NextResponse.json(
        { error: 'Invalid top-up product' },
        { status: 400 }
      );
    }

    const product = TOPUP_PRODUCTS[topupProductKey];

    if (!product.priceId) {
      return NextResponse.json(
        { error: 'Top-up product not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Get user Stripe data from Django
    const djangoUrl = `${getBackendUrl()}/api/user/stripe-profile`;
    const userResponse = await fetch(djangoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      if (userResponse.status === 404) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to get user data' },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();

    const userTier = userData.subscription_tier || 'free';
    const isAdmin = userData.role === 'admin' || userData.is_admin === true;

    // AI top-ups require BOTH Expert tier AND admin status
    if (product.type === 'ai_topup') {
      if (userTier !== 'expert') {
        return NextResponse.json(
          {
            error: 'Expert tier required',
            message: 'AI request top-ups are only available with Expert tier subscription.',
            tier_required: 'expert',
            current_tier: userTier,
          },
          { status: 403 }
        );
      }
      if (!isAdmin) {
        return NextResponse.json(
          {
            error: 'Admin access required',
            message: 'AI request top-ups are only available for admin users with Expert tier subscription.',
            admin_required: true,
          },
          { status: 403 }
        );
      }
    }

    // Check if user's tier allows this top-up
    const isEligible = checkTopupEligibility(userTier, product.requiredTier, product.type);

    if (!isEligible) {
      return NextResponse.json(
        {
          error: 'Subscription tier required',
          message: `This top-up requires at least ${product.requiredTier} tier subscription. Your current tier is ${userTier}.`,
          required_tier: product.requiredTier,
          current_tier: userTier,
        },
        { status: 403 }
      );
    }

    let customerId = userData.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: `${userData.first_name} ${userData.last_name}`,
        metadata: {
          supabase_user_id: userData.id,
          auth_user_id: userData.auth_user_id,
        },
      });

      customerId = customer.id;

      // Save customer ID to Django
      const updateResponse = await fetch(`${getBackendUrl()}/api/user/stripe-customer-id`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ stripe_customer_id: customerId }),
      });

      if (!updateResponse.ok) {
        console.error('Failed to save Stripe customer ID');
      }
    }

    // Create checkout session for one-time payment
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    const stripeSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: product.priceId,
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment, not subscription
      success_url: `${origin}/user/profile?topup_success=true&product=${topupProductKey}`,
      cancel_url: `${origin}/user/profile?topup_canceled=true`,
      metadata: {
        user_id: userData.id,
        topup_type: product.type,
        topup_quantity: product.quantity.toString(),
        topup_product: topupProductKey,
      },
    });

    return NextResponse.json({ sessionId: stripeSession.id, url: stripeSession.url });
  } catch (error: unknown) {
    console.error('Error creating top-up checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Check if user's tier is eligible for this top-up
 * For messages: Basic, Pro, and Expert can buy (but different quantities)
 * For AI: Only Expert tier admins can buy (checked separately)
 */
function checkTopupEligibility(
  userTier: string,
  requiredTier: string,
  topupType: 'message_topup' | 'ai_topup'
): boolean {
  // Free tier cannot purchase top-ups
  if (userTier === 'free') return false;

  // AI top-ups require Expert tier + admin (checked separately in route handler)
  if (topupType === 'ai_topup') {
    return true; // Allow if they got this far (tier + admin checks happen before)
  }

  // For message top-ups, check if user's tier matches the required tier
  // Each tier has their own message top-up product
  if (topupType === 'message_topup') {
    return userTier === requiredTier;
  }

  return false;
}
