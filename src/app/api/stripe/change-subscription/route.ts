import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { TIER_PRICE_IDS } from '@/lib/subscription-tiers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// Tier hierarchy for determining upgrades vs downgrades
const TIER_HIERARCHY = {
  free: 0,
  basic: 1,
  pro: 2,
  expert: 3,
};

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
      .select('id, subscription_tier, stripe_subscription_id, billing_cycle_end')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { newTier } = await request.json();

    if (!newTier || !['free', 'basic', 'pro', 'expert'].includes(newTier)) {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 });
    }

    const currentTier = userData.subscription_tier || 'free';

    // Can't change to the same tier
    if (currentTier === newTier) {
      return NextResponse.json({ error: 'Already on this tier' }, { status: 400 });
    }

    // Handle cancellation (downgrade to free)
    if (newTier === 'free') {
      if (!userData.stripe_subscription_id) {
        return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 });
      }

      // Schedule cancellation at period end
      await stripe.subscriptions.update(userData.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      // Store scheduled tier change
      await adminSupabase
        .from('users')
        .update({
          scheduled_tier_change: 'free',
          scheduled_tier_change_date: userData.billing_cycle_end,
        })
        .eq('id', userData.id);

      return NextResponse.json({
        success: true,
        message: 'Subscription will be canceled at the end of the billing period',
        scheduled_tier: 'free',
        effective_date: userData.billing_cycle_end,
      });
    }

    // Get the new price ID
    const newPriceId = TIER_PRICE_IDS[newTier as keyof typeof TIER_PRICE_IDS];
    if (!newPriceId) {
      return NextResponse.json({ error: 'Invalid tier configuration' }, { status: 500 });
    }

    // Determine if this is an upgrade or downgrade
    const isUpgrade = TIER_HIERARCHY[newTier as keyof typeof TIER_HIERARCHY] > TIER_HIERARCHY[currentTier as keyof typeof TIER_HIERARCHY];

    // Handle upgrade from free tier (create new subscription)
    if (currentTier === 'free') {
      // Create checkout session for new subscription
      const session = await stripe.checkout.sessions.create({
        customer: undefined, // Will be created automatically
        line_items: [
          {
            price: newPriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/user/profile?upgrade=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/user/profile?upgrade=cancelled`,
        metadata: {
          user_id: userData.id,
          tier: newTier,
        },
      });

      return NextResponse.json({
        success: true,
        checkoutUrl: session.url,
      });
    }

    // Handle upgrade/downgrade for existing subscription
    if (!userData.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Get current subscription details
    const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id);

    if (!subscription || subscription.items.data.length === 0) {
      return NextResponse.json({ error: 'Invalid subscription state' }, { status: 400 });
    }

    const currentSubscriptionItem = subscription.items.data[0];

    if (isUpgrade) {
      // UPGRADE: Immediate change with proration
      console.log(`🔼 UPGRADE: ${currentTier} → ${newTier} for user ${userData.id}`);

      // Get all current subscription items (main price + metered prices)
      const allItems = subscription.items.data;
      console.log(`Current subscription has ${allItems.length} items:`, allItems.map(item => ({
        id: item.id,
        priceId: item.price.id,
        type: item.price.recurring?.usage_type || 'licensed'
      })));

      // Build items array: update main price, delete old metered prices
      const itemsToUpdate = [];

      // Update the main subscription price
      itemsToUpdate.push({
        id: currentSubscriptionItem.id,
        price: newPriceId,
      });

      // Delete old tier's metered prices
      for (const item of allItems) {
        if (item.id !== currentSubscriptionItem.id) {
          // This is a metered price item - delete it
          console.log(`Removing old metered price: ${item.price.id}`);
          itemsToUpdate.push({
            id: item.id,
            deleted: true,
          });
        }
      }

      // Update subscription with new main price and remove old metered prices
      await stripe.subscriptions.update(userData.stripe_subscription_id, {
        items: itemsToUpdate,
        proration_behavior: 'always_invoice',
        billing_cycle_anchor: 'unchanged',
      });

      // Add new tier's metered prices
      const meteredPrices: string[] = [];
      if (newTier === 'basic') {
        meteredPrices.push(process.env.STRIPE_BASIC_METERED_MESSAGES_PRICE_ID!);
      } else if (newTier === 'pro') {
        meteredPrices.push(process.env.STRIPE_PRO_METERED_MESSAGES_PRICE_ID!);
      } else if (newTier === 'expert') {
        meteredPrices.push(process.env.STRIPE_EXPERT_METERED_MESSAGES_PRICE_ID!);

        // Check if user is admin - only admins get AI metered price
        const { data: userDetails } = await adminSupabase
          .from('users')
          .select('is_admin')
          .eq('id', userData.id)
          .single();

        if (userDetails?.is_admin) {
          meteredPrices.push(process.env.STRIPE_EXPERT_METERED_AI_PRICE_ID!);
          console.log(`User ${userData.id} is admin - adding AI metered price`);
        } else {
          console.log(`User ${userData.id} is not admin - skipping AI metered price`);
        }
      }

      // Add new metered prices
      for (const meteredPrice of meteredPrices) {
        if (meteredPrice) {
          try {
            await stripe.subscriptionItems.create({
              subscription: userData.stripe_subscription_id,
              price: meteredPrice,
            });
            console.log(`✅ Added metered price ${meteredPrice} for ${newTier} tier`);
          } catch (error: any) {
            console.error(`❌ Failed to add metered price ${meteredPrice}:`, error.message);
          }
        }
      }

      // Update user tier immediately
      await adminSupabase
        .from('users')
        .update({
          subscription_tier: newTier,
          scheduled_tier_change: null,
          scheduled_tier_change_date: null,
        })
        .eq('id', userData.id);

      return NextResponse.json({
        success: true,
        message: `Upgraded to ${newTier} tier successfully. Prorated charges have been applied.`,
        newTier,
        immediate: true,
      });
    } else {
      // DOWNGRADE: Schedule for next billing period
      // IMPORTANT: We do NOT update Stripe subscription here!
      // We only store the scheduled change in our database.
      // The actual Stripe subscription update happens in the webhook when the billing cycle renews.

      // Get billing cycle end (future-proof for API version 2025-03-31)
      const periodEnd = subscription.current_period_end || subscription.items.data[0]?.current_period_end;

      if (!periodEnd) {
        console.error('❌ Missing period_end for downgrade scheduling:', subscription.id);
        // console.error('Full subscription object:', JSON.stringify(subscription, null, 2));
        return NextResponse.json({ error: 'Unable to schedule downgrade - missing billing cycle data' }, { status: 500 });
      }

      const effectiveDate = new Date(periodEnd * 1000).toISOString();

      console.log(`🔽 DOWNGRADE SCHEDULED: ${currentTier} → ${newTier} for user ${userData.id}`);
      console.log(`Will take effect on: ${effectiveDate} (timestamp: ${periodEnd})`);
      console.log(`⚠️  NOT updating Stripe subscription yet - will update on renewal webhook`);

      // Store scheduled tier change in database ONLY
      // Do NOT touch Stripe subscription yet
      await adminSupabase
        .from('users')
        .update({
          scheduled_tier_change: newTier,
          scheduled_tier_change_date: effectiveDate,
        })
        .eq('id', userData.id);

      return NextResponse.json({
        success: true,
        message: `Downgrade to ${newTier} tier scheduled for next billing cycle on ${new Date(effectiveDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        scheduledTier: newTier,
        effectiveDate,
        immediate: false,
      });
    }
  } catch (error: any) {
    console.error('Error changing subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to change subscription' },
      { status: 500 }
    );
  }
}
