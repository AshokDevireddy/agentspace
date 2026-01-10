import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { getTierFromPriceId, TIER_PRICE_IDS } from '@/lib/subscription-tiers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Helper function to get price ID from tier name
function getTierPriceId(tier: string): string | null {
  return TIER_PRICE_IDS[tier as keyof typeof TIER_PRICE_IDS] || null;
}

/**
 * TEST ENDPOINT: Simulate Billing Cycle Renewal
 *
 * This endpoint simulates what happens when a Stripe subscription renews.
 * Use this to test scheduled tier changes without waiting for actual renewal.
 *
 * Usage:
 * POST /api/test/simulate-renewal
 *
 * What it does:
 * 1. Gets your current subscription from Stripe
 * 2. Simulates the customer.subscription.updated webhook with a new billing cycle
 * 3. Applies any scheduled tier changes
 * 4. Resets usage counters
 *
 * ⚠️  WARNING: This is for TESTING only. Do NOT use in production.
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'This endpoint is only available in development' }, { status: 403 });
  }

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

    // Get user details
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('id, stripe_subscription_id, subscription_tier, scheduled_tier_change, billing_cycle_start, billing_cycle_end')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!userData.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    console.log('🧪 TEST: Simulating billing cycle renewal for user', userData.id);
    console.log('Current state:', {
      tier: userData.subscription_tier,
      scheduledTier: userData.scheduled_tier_change,
      billingCycleStart: userData.billing_cycle_start,
      billingCycleEnd: userData.billing_cycle_end,
    });

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id);

    // Calculate new billing cycle dates (advance by 1 month)
    const currentPeriodEnd = subscription.current_period_end || subscription.items.data[0]?.current_period_end;
    if (!currentPeriodEnd) {
      return NextResponse.json({ error: 'Unable to determine billing cycle' }, { status: 500 });
    }

    const newPeriodStart = currentPeriodEnd; // New cycle starts where old one ended
    const newPeriodEnd = newPeriodStart + (30 * 24 * 60 * 60); // Add 30 days

    const newBillingCycleStart = new Date(newPeriodStart * 1000).toISOString();
    const newBillingCycleEnd = new Date(newPeriodEnd * 1000).toISOString();

    console.log('🔄 Simulating renewal with new billing cycle:', {
      oldStart: userData.billing_cycle_start,
      newStart: newBillingCycleStart,
      oldEnd: userData.billing_cycle_end,
      newEnd: newBillingCycleEnd,
    });

    // Prepare update data
    const updateData: any = {
      billing_cycle_start: newBillingCycleStart,
      billing_cycle_end: newBillingCycleEnd,
      messages_sent_count: 0,
      messages_reset_date: newBillingCycleStart,
      ai_requests_count: 0,
      ai_requests_reset_date: newBillingCycleStart,
    };

    let appliedTierChange = false;

    // Apply scheduled tier change if exists
    if (userData.scheduled_tier_change) {
      console.log(`📋 Applying scheduled tier change: ${userData.subscription_tier} → ${userData.scheduled_tier_change}`);

      // Update Stripe subscription to new tier
      const newPriceId = getTierPriceId(userData.scheduled_tier_change);
      if (newPriceId) {
        console.log(`🔧 Updating Stripe subscription to new tier price: ${newPriceId}`);

        // Get all current items
        const allItems = subscription.items.data;
        const mainItem = allItems[0];

        // Build items array: update main price, delete metered prices
        const itemsToUpdate = [
          {
            id: mainItem.id,
            price: newPriceId,
          }
        ];

        // Delete old metered prices
        for (const item of allItems) {
          if (item.id !== mainItem.id) {
            console.log(`Removing metered price: ${item.price.id}`);
            itemsToUpdate.push({
              id: item.id,
              deleted: true,
            });
          }
        }

        // Update subscription
        await stripe.subscriptions.update(subscription.id, {
          items: itemsToUpdate,
          proration_behavior: 'none',
          billing_cycle_anchor: 'unchanged',
        });

        // Add new tier's metered prices
        const meteredPrices: string[] = [];
        if (userData.scheduled_tier_change === 'basic') {
          meteredPrices.push(process.env.STRIPE_BASIC_METERED_MESSAGES_PRICE_ID!);
        } else if (userData.scheduled_tier_change === 'pro') {
          meteredPrices.push(process.env.STRIPE_PRO_METERED_MESSAGES_PRICE_ID!);
        } else if (userData.scheduled_tier_change === 'expert') {
          meteredPrices.push(process.env.STRIPE_EXPERT_METERED_MESSAGES_PRICE_ID!);

          // Check if user is admin
          const { data: userDetails } = await adminSupabase
            .from('users')
            .select('is_admin')
            .eq('id', userData.id)
            .single();

          if (userDetails?.is_admin) {
            meteredPrices.push(process.env.STRIPE_EXPERT_METERED_AI_PRICE_ID!);
            console.log('User is admin - adding AI metered price');
          }
        }

        // Add metered prices
        for (const meteredPrice of meteredPrices) {
          if (meteredPrice) {
            try {
              await stripe.subscriptionItems.create({
                subscription: subscription.id,
                price: meteredPrice,
              });
              console.log(`✅ Added metered price: ${meteredPrice}`);
            } catch (error: any) {
              console.error(`❌ Failed to add metered price:`, error.message);
            }
          }
        }

        console.log(`✅ Stripe subscription updated to ${userData.scheduled_tier_change} tier`);
      }

      updateData.subscription_tier = userData.scheduled_tier_change;
      updateData.scheduled_tier_change = null;
      updateData.scheduled_tier_change_date = null;
      appliedTierChange = true;

      console.log(`✅ Scheduled tier change applied: now on ${userData.scheduled_tier_change} tier`);
    }

    // Update database
    const { error: updateError } = await adminSupabase
      .from('users')
      .update(updateData)
      .eq('id', userData.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Billing cycle renewal simulated successfully',
      details: {
        oldBillingCycle: {
          start: userData.billing_cycle_start,
          end: userData.billing_cycle_end,
        },
        newBillingCycle: {
          start: newBillingCycleStart,
          end: newBillingCycleEnd,
        },
        tierChange: appliedTierChange ? {
          from: userData.subscription_tier,
          to: userData.scheduled_tier_change,
        } : null,
        usageReset: {
          messages: 0,
          aiRequests: 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Error simulating renewal:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to simulate renewal' },
      { status: 500 }
    );
  }
}
