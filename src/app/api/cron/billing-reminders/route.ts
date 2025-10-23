/**
 * Billing Reminders Cron Job
 * Runs daily at 8 AM to remind clients about upcoming premium payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/telnyx';
import {
  getOrCreateConversation,
  logMessage,
} from '@/lib/sms-helpers';

/**
 * Calculate next billing date based on policy effective date and billing cycle
 */
function getNextBillingDate(effectiveDate: Date, billingCycle: string): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effective = new Date(effectiveDate);
  effective.setHours(0, 0, 0, 0);

  let nextBilling = new Date(effective);

  switch (billingCycle) {
    case 'monthly':
      // Find next monthly anniversary
      while (nextBilling <= today) {
        nextBilling.setMonth(nextBilling.getMonth() + 1);
      }
      break;

    case 'quarterly':
      // Find next quarterly anniversary (every 3 months)
      while (nextBilling <= today) {
        nextBilling.setMonth(nextBilling.getMonth() + 3);
      }
      break;

    case 'semi-annually':
      // Find next semi-annual anniversary (every 6 months)
      while (nextBilling <= today) {
        nextBilling.setMonth(nextBilling.getMonth() + 6);
      }
      break;

    case 'annually':
      // Find next annual anniversary
      while (nextBilling <= today) {
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      }
      break;

    default:
      return null;
  }

  return nextBilling;
}

/**
 * Check if next billing date is exactly 3 days from now
 */
function isDueInThreeDays(nextBillingDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  return nextBillingDate.getTime() === threeDaysFromNow.getTime();
}

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.CRON_SECRET) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const supabase = createAdminClient();

    console.log('Running billing reminders cron');

    // Query active deals with billing cycle information
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        id,
        client_name,
        client_phone,
        billing_cycle,
        policy_effective_date,
        agent_id,
        agent:agent_id (
          id,
          first_name,
          last_name,
          agency_id,
          agency:agency_id (
            id,
            name,
            phone_number
          )
        )
      `)
      .eq('status', 'active')
      .not('client_phone', 'is', null)
      .not('billing_cycle', 'is', null)
      .not('policy_effective_date', 'is', null);

    if (dealsError) {
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('No active deals with billing information found');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No active policies with billing info',
      });
    }

    console.log(`Found ${deals.length} active deals to check`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each deal
    for (const deal of deals) {
      try {
        const agent = deal.agent;
        const agency = agent?.agency;

        if (!agent || !agency?.phone_number) {
          console.warn(`Skipping deal ${deal.id}: Missing agent or agency phone`);
          skippedCount++;
          continue;
        }

        // Calculate next billing date
        const nextBillingDate = getNextBillingDate(
          new Date(deal.policy_effective_date),
          deal.billing_cycle
        );

        if (!nextBillingDate) {
          console.warn(`Skipping deal ${deal.id}: Invalid billing cycle`);
          skippedCount++;
          continue;
        }

        // Check if billing is due in 3 days
        if (!isDueInThreeDays(nextBillingDate)) {
          skippedCount++;
          continue;
        }

        // Get first name from client_name
        const firstName = deal.client_name.split(' ')[0];
        const messageText = `Hi ${firstName}, this is a friendly reminder that your insurance premium is due soon. Please ensure funds are available for your scheduled payment. Thank you!`;

        // Send SMS
        await sendSMS({
          from: agency.phone_number,
          to: deal.client_phone,
          text: messageText,
        });

        // Get or create conversation (using client phone to prevent duplicates)
        const conversation = await getOrCreateConversation(
          agent.id,
          deal.id,
          agent.agency_id,
          deal.client_phone
        );

        // Log the message
        await logMessage({
          conversationId: conversation.id,
          senderId: agent.id,
          receiverId: agent.id, // Placeholder
          body: messageText,
          direction: 'outbound',
          status: 'sent',
          metadata: {
            automated: true,
            type: 'billing_reminder',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
            billing_cycle: deal.billing_cycle,
            next_billing_date: nextBillingDate.toISOString(),
          },
        });

        successCount++;
        console.log(`Sent billing reminder to ${deal.client_name}`);

      } catch (error) {
        console.error(`Failed to send billing reminder for deal ${deal.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      skipped: skippedCount,
      total: deals.length,
    });

  } catch (error) {
    console.error('Billing reminders cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

