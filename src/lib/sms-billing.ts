import { createAdminClient } from '@/lib/supabase/server';
import { getTierLimits } from '@/lib/subscription-tiers';
import { reportMessageUsage, getMeteredSubscriptionItems } from '@/lib/stripe-usage';

/**
 * Increment an agent's messages_sent_count by 1 and handle billing.
 *
 * - Resets counter when the billing cycle has ended
 * - Reports overage to Stripe when the agent exceeds their tier limit
 * - Never throws — billing failures are logged but don't block message delivery
 *
 * @returns The new message count, or -1 on failure
 */
export async function incrementMessageCount(agentId: string): Promise<number> {
  try {
    const supabase = createAdminClient();

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('messages_sent_count, subscription_tier, stripe_subscription_id, billing_cycle_end')
      .eq('id', agentId)
      .single();

    if (fetchError || !user) {
      console.error(`Failed to fetch user for SMS billing (${agentId}):`, fetchError);
      return -1;
    }

    const now = new Date();
    const billingCycleEnd = user.billing_cycle_end ? new Date(user.billing_cycle_end) : null;
    const cycleExpired = billingCycleEnd !== null && now > billingCycleEnd;

    if (cycleExpired) {
      console.log(`Resetting SMS count for new billing cycle for user ${agentId}`);
    }

    const newCount = (cycleExpired ? 0 : (user.messages_sent_count || 0)) + 1;

    const updatePayload: Record<string, unknown> = { messages_sent_count: newCount };
    if (cycleExpired) {
      updatePayload.messages_reset_date = now.toISOString();
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', agentId);

    if (updateError) {
      console.error(`Failed to update messages_sent_count for user ${agentId}:`, updateError);
      return -1;
    }

    const tierLimits = getTierLimits(user.subscription_tier || 'free');
    if (newCount > tierLimits.messages && user.stripe_subscription_id) {
      const { messagesItemId } = await getMeteredSubscriptionItems(user.stripe_subscription_id);
      if (messagesItemId) {
        await reportMessageUsage(user.stripe_subscription_id, messagesItemId, 1);
        console.log(`Reported SMS overage for user ${agentId}: message #${newCount} (limit: ${tierLimits.messages})`);
      }
    }

    return newCount;
  } catch (error) {
    console.error(`Unexpected error in incrementMessageCount for user ${agentId}:`, error);
    return -1;
  }
}
