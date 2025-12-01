import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getTierFromPriceId, TIER_PRICE_IDS } from '@/lib/subscription-tiers';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// This needs to use the service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get price ID from tier name
function getTierPriceId(tier: string): string | null {
  return TIER_PRICE_IDS[tier as keyof typeof TIER_PRICE_IDS] || null;
}

// Disable body parsing for this route to get raw body for Stripe signature verification
export const runtime = 'nodejs';

// CRITICAL: This tells Next.js not to parse the body automatically
// Without this, Stripe signature verification will fail
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Get the raw body as a buffer/string - must be the exact raw bytes from Stripe
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Webhook signature verification failed:', errorMessage);

    // In development mode with Stripe CLI, signature verification can fail
    // Parse the event directly instead (NOT RECOMMENDED FOR PRODUCTION)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  DEV MODE: Bypassing signature verification - DO NOT USE IN PRODUCTION');
      try {
        event = JSON.parse(rawBody) as Stripe.Event;
      } catch (parseErr) {
        console.error('Failed to parse webhook body');
        return NextResponse.json(
          { error: 'Invalid webhook payload' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;

  if (!userId) {
    console.error('Missing user_id in checkout session metadata');
    return;
  }

  // Check if this is a subscription or a one-time payment (top-up)
  const mode = session.mode;

  if (mode === 'subscription') {
    // Handle subscription checkout
    const subscriptionId = session.subscription as string;

    // Retrieve subscription to get the price ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;

    if (!priceId) {
      console.error('No price ID found in subscription');
      return;
    }

    // Determine tier from price ID
    const tier = getTierFromPriceId(priceId);

    // Get current user data to preserve usage counts
    const { data: currentUser } = await supabase
      .from('users')
      .select('deals_created_count, messages_sent_count, ai_requests_count')
      .eq('id', userId)
      .single();

    // Check for required billing cycle dates (future-proof for API version 2025-03-31)
    // Try subscription-level fields first (current API), then fall back to item-level fields (new API)
    const periodStart = subscription.current_period_start || subscription.items.data[0]?.current_period_start;
    const periodEnd = subscription.current_period_end || subscription.items.data[0]?.current_period_end;

    if (!periodStart || !periodEnd) {
      console.error('Missing billing cycle dates in subscription:', subscription.id);
      console.error('Subscription object (full):', JSON.stringify(subscription, null, 2));
      console.error('Subscription items:', JSON.stringify(subscription.items.data, null, 2));
      return;
    }

    console.log(`📅 Billing cycle dates for subscription ${subscription.id}:`, {
      periodStart,
      periodEnd,
      source: subscription.current_period_start ? 'subscription-level' : 'item-level',
      periodStartDate: new Date(periodStart * 1000).toISOString(),
      periodEndDate: new Date(periodEnd * 1000).toISOString(),
    });

    // Get billing cycle dates from subscription
    const billingCycleStart = new Date(periodStart * 1000).toISOString();
    const billingCycleEnd = new Date(periodEnd * 1000).toISOString();

    const { data, error} = await supabase
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_tier: tier,
        stripe_subscription_id: subscriptionId,
        // Set billing cycle dates from Stripe
        billing_cycle_start: billingCycleStart,
        billing_cycle_end: billingCycleEnd,
        // Reset usage counts at start of new billing cycle
        messages_sent_count: 0,
        messages_reset_date: billingCycleStart,
        ai_requests_count: 0,
        ai_requests_reset_date: billingCycleStart,
        // Preserve deals count
        deals_created_count: currentUser?.deals_created_count || 0,
      })
      .eq('id', userId);

    if (error) {
      console.error(`Error updating user ${userId}:`, error);
    } else {
      console.log(`Subscription activated for user ${userId}: ${tier} tier`);
    }

    // Add metered prices to the subscription for usage-based billing
    const meteredPrices: string[] = [];

    if (tier === 'basic') {
      meteredPrices.push(process.env.STRIPE_BASIC_METERED_MESSAGES_PRICE_ID!);
    } else if (tier === 'pro') {
      meteredPrices.push(process.env.STRIPE_PRO_METERED_MESSAGES_PRICE_ID!);
    } else if (tier === 'expert') {
      meteredPrices.push(process.env.STRIPE_EXPERT_METERED_MESSAGES_PRICE_ID!);
      meteredPrices.push(process.env.STRIPE_EXPERT_METERED_AI_PRICE_ID!);
    }

    // Get existing subscription items to avoid duplicates
    const existingPriceIds = subscription.items.data.map(item => item.price.id);
    console.log('Existing price IDs on subscription:', existingPriceIds);

    // Add metered prices to subscription (only if they don't already exist)
    for (const meteredPrice of meteredPrices) {
      if (meteredPrice) {
        if (existingPriceIds.includes(meteredPrice)) {
          console.log(`⏭️  Metered price ${meteredPrice} already exists on subscription ${subscriptionId}, skipping`);
          continue;
        }

        try {
          await stripe.subscriptionItems.create({
            subscription: subscriptionId,
            price: meteredPrice,
          });
          console.log(`✅ Added metered price ${meteredPrice} to subscription ${subscriptionId}`);
        } catch (error: any) {
          console.error(`❌ Failed to add metered price ${meteredPrice}:`, error.message);
          // Don't throw - just log the error and continue
        }
      }
    }
  } else if (mode === 'payment') {
    // Handle one-time payment (top-up) - will be processed in payment_intent.succeeded
    console.log(`One-time payment checkout completed for user ${userId}, waiting for payment_intent.succeeded`);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Get the checkout session to access metadata
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent.id,
    limit: 1,
  });

  const session = sessions.data[0];

  if (!session || !session.metadata) {
    console.error('No session found for payment intent or missing metadata');
    return;
  }

  const userId = session.metadata.user_id;
  const topupType = session.metadata.topup_type as 'message_topup' | 'ai_topup';
  const topupQuantity = parseInt(session.metadata.topup_quantity || '0');
  const topupProduct = session.metadata.topup_product;

  if (!userId || !topupType || !topupQuantity) {
    console.error('Missing required metadata in payment intent session');
    return;
  }

  // Get current user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('messages_topup_credits, ai_requests_topup_credits')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    console.error(`Error fetching user ${userId}:`, userError);
    return;
  }

  // Add credits based on top-up type
  const updates: { messages_topup_credits?: number; ai_requests_topup_credits?: number } = {};

  if (topupType === 'message_topup') {
    updates.messages_topup_credits = (userData.messages_topup_credits || 0) + topupQuantity;
  } else if (topupType === 'ai_topup') {
    updates.ai_requests_topup_credits = (userData.ai_requests_topup_credits || 0) + topupQuantity;
  }

  // Update user credits
  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    console.error(`Error updating credits for user ${userId}:`, updateError);
    return;
  }

  // Record purchase in purchases table
  const amountCents = paymentIntent.amount;
  const currency = paymentIntent.currency;

  const { error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      purchase_type: topupType,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: amountCents,
      currency: currency,
      quantity: topupQuantity,
      description: `${topupQuantity} ${topupType === 'message_topup' ? 'messages' : 'AI requests'} top-up`,
      status: 'completed',
      purchased_at: new Date(paymentIntent.created * 1000).toISOString(),
      metadata: {
        product: topupProduct,
        payment_method: paymentIntent.payment_method,
      },
    });

  if (purchaseError) {
    console.error(`Error recording purchase for user ${userId}:`, purchaseError);
  } else {
    console.log(`✅ Top-up successful: User ${userId} received ${topupQuantity} ${topupType} credits`);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;

  if (!userId) {
    console.error('Missing user_id in subscription metadata');
    return;
  }

  // Log full subscription object for debugging
  console.log('🔍 WEBHOOK: customer.subscription.updated received');
  console.log('Subscription ID:', subscription.id);
  console.log('User ID:', userId);
  console.log('Subscription status:', subscription.status);
  // console.log('Full subscription object:', JSON.stringify(subscription, null, 2));

  // Check for required billing cycle dates (future-proof for API version 2025-03-31)
  // Try subscription-level fields first (current API), then fall back to item-level fields (new API)
  const periodStart = subscription.current_period_start || subscription.items.data[0]?.current_period_start;
  const periodEnd = subscription.current_period_end || subscription.items.data[0]?.current_period_end;

  if (!periodStart || !periodEnd) {
    console.error('❌ Missing billing cycle dates in subscription:', subscription.id);
    console.error('Checked locations:');
    console.error('  - subscription.current_period_start:', subscription.current_period_start);
    console.error('  - subscription.current_period_end:', subscription.current_period_end);
    console.error('  - subscription.items.data[0]?.current_period_start:', subscription.items.data[0]?.current_period_start);
    console.error('  - subscription.items.data[0]?.current_period_end:', subscription.items.data[0]?.current_period_end);
    console.error('Subscription items:', JSON.stringify(subscription.items.data, null, 2));
    return;
  }

  console.log(`📅 Billing cycle dates found:`, {
    periodStart,
    periodEnd,
    source: subscription.current_period_start ? 'subscription-level' : 'item-level',
    periodStartDate: new Date(periodStart * 1000).toISOString(),
    periodEndDate: new Date(periodEnd * 1000).toISOString(),
  });

  // Update subscription status
  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'canceled' : 'free';

  // Get tier from price ID
  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? getTierFromPriceId(priceId) : 'free';

  console.log('📊 Subscription details:', {
    tier,
    status,
    priceId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  // Get billing cycle dates from subscription
  const billingCycleStart = new Date(periodStart * 1000).toISOString();
  const billingCycleEnd = new Date(periodEnd * 1000).toISOString();

  // Get current user data to check if billing cycle has changed (renewal)
  const { data: currentUser } = await supabase
    .from('users')
    .select('billing_cycle_start, billing_cycle_end, scheduled_tier_change, subscription_tier')
    .eq('id', userId)
    .single();

  console.log('Current user data from database:', {
    currentBillingCycleStart: currentUser?.billing_cycle_start,
    currentBillingCycleEnd: currentUser?.billing_cycle_end,
    currentTier: currentUser?.subscription_tier,
    scheduledTierChange: currentUser?.scheduled_tier_change,
    newBillingCycleStart: billingCycleStart,
    newBillingCycleEnd: billingCycleEnd,
    newTier: tier,
  });

  // Check if this is a TRUE renewal (billing cycle has ACTUALLY changed, not just a subscription update)
  // A renewal happens when billing_cycle_start changes to a FUTURE date
  const isRenewal = currentUser?.billing_cycle_start &&
                    currentUser.billing_cycle_start !== billingCycleStart &&
                    new Date(billingCycleStart) > new Date(currentUser.billing_cycle_start);

  console.log('Is this a renewal?', isRenewal);

  const updateData: any = {
    subscription_status: status,
    billing_cycle_start: billingCycleStart,
    billing_cycle_end: billingCycleEnd,
  };

  // If this is a renewal, reset usage counts and handle scheduled tier changes
  if (isRenewal) {
    console.log(`🔄 TRUE BILLING CYCLE RENEWAL detected for user ${userId}`);

    // Reset usage counts
    updateData.messages_sent_count = 0;
    updateData.messages_reset_date = billingCycleStart;
    updateData.ai_requests_count = 0;
    updateData.ai_requests_reset_date = billingCycleStart;

    // Apply scheduled tier change if one exists
    if (currentUser?.scheduled_tier_change) {
      console.log(`📋 Applying scheduled tier change: ${currentUser.subscription_tier} → ${currentUser.scheduled_tier_change}`);

      // NOW update the Stripe subscription to the new tier
      try {
        const newPriceId = getTierPriceId(currentUser.scheduled_tier_change);
        if (newPriceId && subscription.items.data[0]) {
          console.log(`🔧 Updating Stripe subscription to new tier price: ${newPriceId}`);

          // Get all current items (main + metered)
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
              console.log(`🗑️  Removing old metered price: ${item.price.id}`);
              itemsToUpdate.push({
                id: item.id,
                deleted: true,
              });
            }
          }

          // Update subscription with new main price and remove old metered prices
          // Note: This may fail if test clock is advancing - that's okay, database update still happens
          await stripe.subscriptions.update(subscription.id, {
            items: itemsToUpdate,
            proration_behavior: 'none', // No proration since this is at renewal
            billing_cycle_anchor: 'unchanged',
          });

          // Add new tier's metered prices
          const meteredPrices: string[] = [];
          if (currentUser.scheduled_tier_change === 'basic') {
            meteredPrices.push(process.env.STRIPE_BASIC_METERED_MESSAGES_PRICE_ID!);
          } else if (currentUser.scheduled_tier_change === 'pro') {
            meteredPrices.push(process.env.STRIPE_PRO_METERED_MESSAGES_PRICE_ID!);
          } else if (currentUser.scheduled_tier_change === 'expert') {
            meteredPrices.push(process.env.STRIPE_EXPERT_METERED_MESSAGES_PRICE_ID!);

            // Check if user is admin
            const { data: userDetails } = await supabase
              .from('users')
              .select('is_admin')
              .eq('id', userId)
              .single();

            if (userDetails?.is_admin) {
              meteredPrices.push(process.env.STRIPE_EXPERT_METERED_AI_PRICE_ID!);
              console.log(`User ${userId} is admin - adding AI metered price`);
            }
          }

          // Add new metered prices
          for (const meteredPrice of meteredPrices) {
            if (meteredPrice) {
              try {
                await stripe.subscriptionItems.create({
                  subscription: subscription.id,
                  price: meteredPrice,
                });
                console.log(`✅ Added metered price: ${meteredPrice} for ${currentUser.scheduled_tier_change} tier`);
              } catch (error: any) {
                console.error(`❌ Failed to add metered price:`, error.message);
              }
            }
          }

          console.log(`✅ Stripe subscription updated to ${currentUser.scheduled_tier_change} tier with correct metered prices`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to update Stripe subscription for scheduled downgrade:`, error.message);
        // Continue anyway - we'll update our database
      }

      updateData.subscription_tier = currentUser.scheduled_tier_change;
      updateData.scheduled_tier_change = null;
      updateData.scheduled_tier_change_date = null;
      console.log(`✅ Scheduled tier change applied for user ${userId}: now on ${currentUser.scheduled_tier_change} tier`);
    } else {
      // No scheduled change, update to new tier from Stripe
      updateData.subscription_tier = tier;
    }
  } else {
    // Not a renewal - this is either an immediate upgrade or a tier change within the same billing cycle
    // Check if there's a scheduled downgrade
    if (currentUser?.scheduled_tier_change) {
      // If there's a scheduled downgrade, keep the current tier (don't apply the Stripe tier yet)
      console.log(`⏳ Scheduled downgrade exists (${currentUser.subscription_tier} → ${currentUser.scheduled_tier_change}), keeping current tier`);
      updateData.subscription_tier = currentUser.subscription_tier;
    } else {
      // No scheduled change - this must be an immediate upgrade
      console.log(`⬆️ Immediate tier change: ${currentUser?.subscription_tier} → ${tier}`);
      updateData.subscription_tier = tier;
    }
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error(`Error updating subscription for user ${userId}:`, error);
  } else {
    const cancelNote = subscription.cancel_at_period_end ? ' (scheduled to cancel)' : '';
    const renewalNote = isRenewal ? ' [RENEWED - usage reset]' : '';
    const finalTier = updateData.subscription_tier || tier;
    console.log(`Subscription updated for user ${userId}: ${finalTier} tier, status: ${status}${cancelNote}${renewalNote}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;

  if (!userId) {
    console.error('Missing user_id in subscription metadata');
    return;
  }

  // When subscription is deleted, reset everything to free tier
  const { data, error } = await supabase
    .from('users')
    .update({
      subscription_status: 'canceled',
      subscription_tier: 'free',
      stripe_subscription_id: null,
    })
    .eq('id', userId);

  if (error) {
    console.error(`Error canceling subscription for user ${userId}:`, error);
  } else {
    console.log(`Subscription canceled for user ${userId} - reverted to free tier`);
  }
}
