import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminSupabase = createAdminClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user details including current subscription
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('id, subscription_tier, stripe_subscription_id, is_admin')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has an active subscription
    if (!userData.stripe_subscription_id) {
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
    const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id);

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
      subscription: userData.stripe_subscription_id,
      price: priceId,
    });

    console.log(`[add-subscription-item] Added price ${priceId} to subscription ${userData.stripe_subscription_id} for user ${userData.id}`);

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
