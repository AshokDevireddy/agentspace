/**
 * Birthday Messages Cron Job
 * Runs daily at 9 AM to send birthday wishes to clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getConversationIfExists,
  logMessage,
} from '@/lib/sms-helpers';
import { replaceSmsPlaceholders, DEFAULT_SMS_TEMPLATES } from '@/lib/sms-template-helpers';
import { batchFetchAgencySmsSettings } from '@/lib/sms-template-helpers.server';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  try {
    console.log('Birthday messages cron started');

    // Verify this is a cron request
    const authResult = verifyCronRequest(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const supabase = createAdminClient();

    // Get current date in PST (Pacific Time)
    const pstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const month = pstDate.getMonth() + 1; // JavaScript months are 0-indexed
    const day = pstDate.getDate();

    console.log(`📅 Current time (UTC): ${new Date().toISOString()}`);
    console.log(`📅 Current date (PST): ${pstDate.toLocaleDateString('en-US')} - ${month}/${day}`);
    console.log(`📅 Looking for birthdays on: ${month}/${day}`);

    // Query deals using RPC function with proper status checking
    console.log('🔍 Querying deals using RPC function with status_mapping...');
    const { data: birthdayDeals, error: dealsError } = await supabase
      .rpc('get_birthday_message_deals');

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    console.log(`🎉 Found ${birthdayDeals?.length || 0} clients with birthdays TODAY`);

    if (!birthdayDeals || birthdayDeals.length === 0) {
      console.log('⚠️  No birthdays today');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No birthdays today',
      });
    }

    const agencyIds = birthdayDeals.map((d: { agency_id: string }) => d.agency_id);
    const agencySettingsMap = await batchFetchAgencySmsSettings(agencyIds);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Send birthday messages
    console.log('\n💌 Processing birthday messages...');
    for (const deal of birthdayDeals) {
      try {
        console.log(`\n📬 Processing: ${deal.client_name} (${deal.client_phone})`);
        console.log(`  Agent: ${deal.agent_first_name} ${deal.agent_last_name} (ID: ${deal.agent_id})`);
        console.log(`  Agent Tier: ${deal.agent_subscription_tier}`);
        console.log(`  Agency: ${deal.agency_name} (Phone: ${deal.agency_phone})`);

        // Check if messaging is enabled (already filtered by RPC, but double-check)
        if (!deal.messaging_enabled) {
          console.log(`  ⚠️  SKIPPED: Messaging is disabled for agency ${deal.agency_name}`);
          skippedCount++;
          continue;
        }

        // Check agent subscription tier - only Pro and Expert get automated messages
        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          console.log(`  ⏭️  SKIPPED: Agent is on ${deal.agent_subscription_tier} tier (automated messaging restricted to Pro/Expert only)`);
          skippedCount++;
          continue;
        }

        // Check if conversation exists (don't create new ones for cron jobs)
        console.log(`  🔍 Checking for existing conversation...`);
        const conversation = await getConversationIfExists(
          deal.agent_id,
          deal.deal_id,
          deal.agency_id,
          deal.client_phone
        );

        if (!conversation) {
          console.log(`  ⏭️  SKIPPED: No existing conversation found for ${deal.client_name}`);
          skippedCount++;
          continue;
        }

        console.log(`  📞 Conversation ID: ${conversation.id}`);
        console.log(`  📱 SMS Opt-in Status: ${conversation.sms_opt_in_status}`);

        // Check opt-in status - only send to opted-in clients
        if (conversation.sms_opt_in_status !== 'opted_in') {
          console.log(`  ❌ SKIPPED: Client has not opted in (status: ${conversation.sms_opt_in_status})`);
          skippedCount++;
          continue;
        }

        const agencySettings = agencySettingsMap.get(deal.agency_id);
        if (agencySettings?.sms_birthday_enabled === false) {
          console.log(`  ⏭️  SKIPPED: Birthday SMS disabled for agency ${deal.agency_name}`);
          skippedCount++;
          continue;
        }

        // Get first name from client_name
        const firstName = deal.client_name.split(' ')[0];

        // Use agency template or default
        const template = agencySettings?.sms_birthday_template || DEFAULT_SMS_TEMPLATES.birthday;
        const messageText = replaceSmsPlaceholders(template, {
          client_first_name: firstName,
          agency_name: deal.agency_name,
        });

        console.log(`  📝 Message: "${messageText}"`);
        console.log(`  📤 Creating draft message (not sending yet)...`);

        // Create draft message (don't send via Telnyx)
        console.log(`  💾 Logging draft message to database...`);
        await logMessage({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id, // Placeholder
          body: messageText,
          direction: 'outbound',
          status: 'draft', // Create as draft
          metadata: {
            automated: true,
            type: 'birthday',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        });
        console.log(`  💾 Draft message created successfully!`);

        successCount++;
        console.log(`  🎉 SUCCESS: Birthday message created as draft for ${deal.client_name}`);

      } catch (error) {
        console.error(`  ❌ ERROR sending to ${deal.client_name}:`, error);
        errorCount++;
      }
    }

    console.log('\n🎂 ========================================');
    console.log('🎂 BIRTHDAY MESSAGES CRON COMPLETED');
    console.log('🎂 ========================================');
    console.log(`✅ Sent: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📊 Total: ${birthdayDeals.length}`);
    console.log('🎂 ========================================\n');

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      skipped: skippedCount,
      total: birthdayDeals.length,
    });

  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ BIRTHDAY MESSAGES CRON FATAL ERROR');
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

