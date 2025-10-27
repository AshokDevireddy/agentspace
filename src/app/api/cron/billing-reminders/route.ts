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
 * Uses PST timezone for consistency
 */
function getNextBillingDate(effectiveDate: Date, billingCycle: string): Date | null {
  // Get today in PST
  const todayPST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  todayPST.setHours(0, 0, 0, 0);

  // Convert effective date to PST
  const effectivePST = new Date(effectiveDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  effectivePST.setHours(0, 0, 0, 0);

  let nextBilling = new Date(effectivePST);

  switch (billingCycle) {
    case 'monthly':
      // Find next monthly anniversary
      while (nextBilling <= todayPST) {
        nextBilling.setMonth(nextBilling.getMonth() + 1);
      }
      break;

    case 'quarterly':
      // Find next quarterly anniversary (every 3 months)
      while (nextBilling <= todayPST) {
        nextBilling.setMonth(nextBilling.getMonth() + 3);
      }
      break;

    case 'semi-annually':
      // Find next semi-annual anniversary (every 6 months)
      while (nextBilling <= todayPST) {
        nextBilling.setMonth(nextBilling.getMonth() + 6);
      }
      break;

    case 'annually':
      // Find next annual anniversary
      while (nextBilling <= todayPST) {
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
 * Uses PST timezone for consistency
 */
function isDueInThreeDays(nextBillingDate: Date): boolean {
  // Get today in PST
  const todayPST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  todayPST.setHours(0, 0, 0, 0);

  const threeDaysFromNow = new Date(todayPST);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  return nextBillingDate.getTime() === threeDaysFromNow.getTime();
}

export async function GET(request: NextRequest) {
  try {
    console.log('💰 ========================================');
    console.log('💰 BILLING REMINDERS CRON STARTED');
    console.log('💰 ========================================');

    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    console.log('🔐 Auth header:', authHeader ? 'Present' : 'Not present');
    console.log('🔐 CRON_SECRET set:', process.env.CRON_SECRET ? 'Yes' : 'No');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.CRON_SECRET) {
        console.log('❌ Unauthorized - CRON_SECRET mismatch');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    console.log('✅ Authorization passed');

    const supabase = createAdminClient();

    // Get dates in PST
    const todayPST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    todayPST.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(todayPST);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    console.log(`📅 Current time (UTC): ${new Date().toISOString()}`);
    console.log(`📅 Today (PST): ${todayPST.toLocaleDateString('en-US')}`);
    console.log(`📅 Looking for billing due on: ${threeDaysFromNow.toLocaleDateString('en-US')} (3 days from now)`);

    // Query active deals with billing cycle information
    console.log('🔍 Querying active deals with billing information...');
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
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('⚠️  No active deals with billing information found');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No active policies with billing info',
      });
    }

    console.log(`📊 Found ${deals.length} active deals to check`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let dueInThreeDaysCount = 0;

    // Process each deal
    console.log('\n💌 Processing billing reminders...');
    for (const deal of deals) {
      try {
        const agent = deal.agent;
        const agency = agent?.agency;

        // Calculate next billing date
        const nextBillingDate = getNextBillingDate(
          new Date(deal.policy_effective_date),
          deal.billing_cycle
        );

        if (!nextBillingDate) {
          console.log(`  ⏭️  ${deal.client_name}: Invalid billing cycle (${deal.billing_cycle})`);
          skippedCount++;
          continue;
        }

        const nextBillingDateStr = nextBillingDate.toLocaleDateString('en-US');
        const isDue = isDueInThreeDays(nextBillingDate);

        console.log(`  📋 ${deal.client_name}: Next billing ${nextBillingDateStr} ${isDue ? '✅ DUE IN 3 DAYS' : '⏭️'}`);

        // Check if billing is due in 3 days
        if (!isDue) {
          skippedCount++;
          continue;
        }

        dueInThreeDaysCount++;
        console.log(`\n  📬 Processing: ${deal.client_name} (${deal.client_phone})`);

        if (!agent || !agency?.phone_number) {
          console.warn(`    ⚠️  Skipping: Missing agent or agency phone`);
          errorCount++;
          continue;
        }

        console.log(`    Agent: ${agent.first_name} ${agent.last_name} (ID: ${agent.id})`);
        console.log(`    Agency: ${agency.name} (Phone: ${agency.phone_number})`);

        // Get or create conversation (using client phone to prevent duplicates)
        console.log(`    🔍 Getting/creating conversation...`);
        const conversation = await getOrCreateConversation(
          agent.id,
          deal.id,
          agent.agency_id,
          deal.client_phone
        );
        console.log(`    📞 Conversation ID: ${conversation.id}`);
        console.log(`    📱 SMS Opt-in Status: ${conversation.sms_opt_in_status}`);

        // Check opt-in status - only send to opted-in clients
        if (conversation.sms_opt_in_status !== 'opted_in') {
          console.log(`    ❌ SKIPPED: Client has not opted in (status: ${conversation.sms_opt_in_status})`);
          skippedCount++;
          dueInThreeDaysCount--;
          continue;
        }

        // Get first name from client_name
        const firstName = deal.client_name.split(' ')[0];
        const messageText = `Hi ${firstName}, this is a friendly reminder that your insurance premium is due soon. Please ensure funds are available for your scheduled payment. Thank you!`;

        console.log(`    📝 Message: "${messageText}"`);
        console.log(`    📤 Sending from ${agency.phone_number} to ${deal.client_phone}...`);

        // Send SMS
        await sendSMS({
          from: agency.phone_number,
          to: deal.client_phone,
          text: messageText,
        });
        console.log(`    ✅ SMS sent successfully!`);

        // Log the message
        console.log(`    💾 Logging message to database...`);
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
        console.log(`    💾 Message logged successfully!`);

        successCount++;
        console.log(`    🎉 SUCCESS: Billing reminder sent to ${deal.client_name}\n`);

      } catch (error) {
        console.error(`    ❌ ERROR sending to ${deal.client_name}:`, error);
        errorCount++;
      }
    }

    console.log('\n💰 ========================================');
    console.log('💰 BILLING REMINDERS CRON COMPLETED');
    console.log('💰 ========================================');
    console.log(`✅ Sent: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📊 Due in 3 days: ${dueInThreeDaysCount}`);
    console.log(`📊 Total deals checked: ${deals.length}`);
    console.log('💰 ========================================\n');

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      skipped: skippedCount,
      total: deals.length,
    });

  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ BILLING REMINDERS CRON FATAL ERROR');
    console.error('❌ ========================================');
    console.error('Error:', error);
    console.error('❌ ========================================\n');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

