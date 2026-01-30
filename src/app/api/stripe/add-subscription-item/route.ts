import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-config';
import { getAccessToken } from '@/lib/session';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user via Django backend
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user Stripe profile from Django
    const apiUrl = getApiBaseUrl()
    const profileResponse = await fetch(`${apiUrl}/api/user/stripe-profile/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = await profileResponse.json()

    // Check if user has an active subscription
    const stripeSubscriptionId = userData.stripe_subscription_id || userData.stripeSubscriptionId
    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found. Please subscribe to a plan first.' },
        { status: 400 }
      );
    }

    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }

    // Verify the subscription exists and is active
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription is not active' },
        { status: 400 }
      );
    }

    // Check if this price is already on the subscription
    const existingItem = subscription.items.data.find(
      (item) => item.price.id === priceId
    );

    if (existingItem) {
      return NextResponse.json(
        { error: 'This item is already on your subscription' },
        { status: 400 }
      );
    }

    // Add the new subscription item
    await stripe.subscriptionItems.create({
      subscription: stripeSubscriptionId,
      price: priceId,
    });

    console.log(`[add-subscription-item] Added price ${priceId} to subscription ${stripeSubscriptionId} for user ${userData.id}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription item added successfully',
    });
  } catch (error: unknown) {
    console.error('[add-subscription-item] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to add subscription item';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
