import { stripe } from './stripe';

/**
 * Report usage to Stripe for metered billing using the new Billing Meters API
 * This is called when a user exceeds their tier limit
 *
 * Note: Requires meters to be set up in Stripe Dashboard first
 */

export async function reportMessageUsage(
  subscriptionId: string,
  subscriptionItemId: string,
  quantity: number = 1,
  customerId?: string
): Promise<void> {
  try {
    // Get customer ID from subscription if not provided
    if (!customerId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    }

    // Use the new Billing Meters API
    await stripe.billing.meterEvents.create({
      event_name: 'sms_messages',
      payload: {
        value: quantity.toString(),
        stripe_customer_id: customerId,
      },
    });
    console.log(`✅ Reported ${quantity} message(s) to Stripe for customer ${customerId}`);
  } catch (error) {
    console.error('❌ Error reporting message usage to Stripe:', error);
    // Don't throw - we don't want to block the user's action if Stripe reporting fails
  }
}

export async function reportAIUsage(
  subscriptionId: string,
  subscriptionItemId: string,
  quantity: number = 1,
  customerId?: string
): Promise<void> {
  try {
    // Get customer ID from subscription if not provided
    if (!customerId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    }

    // Use the new Billing Meters API
    await stripe.billing.meterEvents.create({
      event_name: 'ai_requests',
      payload: {
        value: quantity.toString(),
        stripe_customer_id: customerId,
      },
    });
    console.log(`✅ Reported ${quantity} AI request(s) to Stripe for customer ${customerId}`);
  } catch (error) {
    console.error('❌ Error reporting AI usage to Stripe:', error);
    // Don't throw - we don't want to block the user's action if Stripe reporting fails
  }
}

/**
 * Get the metered subscription item ID for a subscription
 * We need this to report usage
 */
export async function getMeteredSubscriptionItems(subscriptionId: string): Promise<{
  messagesItemId?: string;
  aiItemId?: string;
}> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const messagesItem = subscription.items.data.find(item =>
      item.price.id === process.env.STRIPE_BASIC_METERED_MESSAGES_PRICE_ID ||
      item.price.id === process.env.STRIPE_PRO_METERED_MESSAGES_PRICE_ID ||
      item.price.id === process.env.STRIPE_EXPERT_METERED_MESSAGES_PRICE_ID
    );

    const aiItem = subscription.items.data.find(item =>
      item.price.id === process.env.STRIPE_EXPERT_METERED_AI_PRICE_ID
    );

    return {
      messagesItemId: messagesItem?.id,
      aiItemId: aiItem?.id,
    };
  } catch (error) {
    console.error('❌ Error getting metered subscription items:', error);
    return {};
  }
}
