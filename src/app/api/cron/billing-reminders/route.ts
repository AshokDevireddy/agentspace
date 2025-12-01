/**
 * Billing Reminders Cron Job
 * Runs daily at 8 AM to remind clients about upcoming premium payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getConversationIfExists,
  logMessage,
} from '@/lib/sms-helpers';

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

    // Query deals using RPC function with proper status checking
    console.log('🔍 Querying deals using RPC function with status_mapping...');
    const { data: deals, error: dealsError } = await supabase
      .rpc('get_billing_reminder_deals');

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('⚠️  No deals with billing reminders due found');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No billing reminders due',
      });
    }

    console.log(`📊 Found ${deals.length} deals with billing reminders due`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each deal
    console.log('\n💌 Processing billing reminders...');
    for (const deal of deals) {
      try {
        // RPC returns flat structure with all fields
        const nextBillingDateStr = new Date(deal.next_billing_date).toLocaleDateString('en-US');
        console.log(`  📋 ${deal.client_name}: Next billing ${nextBillingDateStr} ✅ DUE IN 3 DAYS`);
        console.log(`\n  📬 Processing: ${deal.client_name} (${deal.client_phone})`);
        console.log(`    Agent: ${deal.agent_first_name} ${deal.agent_last_name} (ID: ${deal.agent_id})`);
        console.log(`    Agent Tier: ${deal.agent_subscription_tier}`);
        console.log(`    Agency: ${deal.agency_name} (Phone: ${deal.agency_phone})`);

        // Check if messaging is enabled (already filtered by RPC, but double-check)
        if (!deal.messaging_enabled) {
          console.log(`    ⚠️  SKIPPED: Messaging is disabled for agency ${deal.agency_name}`);
          skippedCount++;
          continue;
        }

        // Check agent subscription tier - only Pro and Expert get automated messages
        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          console.log(`    ⏭️  SKIPPED: Agent is on ${deal.agent_subscription_tier} tier (automated messaging restricted to Pro/Expert only)`);
          skippedCount++;
          continue;
        }

        // Check if conversation exists (don't create new ones for cron jobs)
        console.log(`    🔍 Checking for existing conversation...`);
        const conversation = await getConversationIfExists(
          deal.agent_id,
          deal.deal_id,
          deal.agency_id,
          deal.client_phone
        );

        if (!conversation) {
          console.log(`    ⏭️  SKIPPED: No existing conversation found for ${deal.client_name}`);
          skippedCount++;
          continue;
        }

        console.log(`    📞 Conversation ID: ${conversation.id}`);
        console.log(`    📱 SMS Opt-in Status: ${conversation.sms_opt_in_status}`);

        // Check opt-in status - only send to opted-in clients
        if (conversation.sms_opt_in_status !== 'opted_in') {
          console.log(`    ❌ SKIPPED: Client has not opted in (status: ${conversation.sms_opt_in_status})`);
          skippedCount++;
          continue;
        }

        // Get first name from client_name
        const firstName = deal.client_name.split(' ')[0];
        const messageText = `Hi ${firstName}, this is a friendly reminder that your insurance premium is due soon. Please ensure funds are available for your scheduled payment. Thank you!`;

        console.log(`    📝 Message: "${messageText}"`);
        console.log(`    📤 Creating draft message (not sending yet)...`);

        // Create draft message (don't send via Telnyx)
        console.log(`    💾 Logging draft message to database...`);
        await logMessage({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id, // Placeholder
          body: messageText,
          direction: 'outbound',
          status: 'draft', // Create as draft
          metadata: {
            automated: true,
            type: 'billing_reminder',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
            billing_cycle: deal.billing_cycle,
            next_billing_date: deal.next_billing_date,
          },
        });
        console.log(`    💾 Draft message created successfully!`);

        successCount++;
        console.log(`    🎉 SUCCESS: Billing reminder created as draft for ${deal.client_name}\n`);

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

