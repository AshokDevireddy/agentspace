/**
 * Lapse Reminders Cron Job
 * Runs every 2 hours to notify clients about pending policy lapses
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

    // Verify this is a cron request
    const authResult = verifyCronRequest(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const supabase = createAdminClient();

    // Query deals using RPC function
    const { data: deals, error: dealsError } = await supabase
      .rpc('get_lapse_reminder_deals');

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No deals eligible for lapse reminders',
      });
    }


    const agencyIds = deals.map((d: { agency_id: string }) => d.agency_id);
    const agencySettingsMap = await batchFetchAgencySmsSettings(agencyIds);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Send lapse reminders
    for (const deal of deals) {
      try {

        // Check if messaging is enabled (already filtered by RPC, but double-check)
        if (!deal.messaging_enabled) {
          skippedCount++;
          continue;
        }

        // Check agent subscription tier - only Pro and Expert get automated messages
        // For Free/Basic tiers, skip both draft creation AND status update
        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          skippedCount++;
          continue;
        }

        // Check if conversation exists (don't create new ones for cron jobs)
        const conversation = await getConversationIfExists(
          deal.agent_id,
          deal.deal_id,
          deal.agency_id,
          deal.client_phone
        );

        if (!conversation) {
          skippedCount++;
          continue;
        }


        // Check opt-in status - only send to opted-in clients
        if (conversation.sms_opt_in_status !== 'opted_in') {
          skippedCount++;
          continue;
        }

        const agencySettings = agencySettingsMap.get(deal.agency_id);
        if (agencySettings?.sms_lapse_reminder_enabled === false) {
          skippedCount++;
          continue;
        }

        const agentName = `${deal.agent_first_name} ${deal.agent_last_name}`;
        const agentPhone = deal.agent_phone || 'your agent';
        const clientFirstName = deal.client_name.split(' ')[0]; // Extract first name

        // Use agency template or default
        const template = agencySettings?.sms_lapse_reminder_template || DEFAULT_SMS_TEMPLATES.lapse_reminder;
        const messageText = replaceSmsPlaceholders(template, {
          client_first_name: clientFirstName,
          agent_name: agentName,
          agent_phone: agentPhone,
        });


        // Create draft message (don't send via Telnyx yet)
        await logMessage({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id, // Placeholder
          body: messageText,
          direction: 'outbound',
          status: 'draft', // Create as draft
          metadata: {
            automated: true,
            type: 'lapse_reminder',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        });

        // Update deal status_standardized using staged notification logic
        // If email was already sent (lapse_email_notified) → lapse_sms_and_email_notified
        // Otherwise → lapse_sms_notified
        const newStatus = deal.status_standardized === 'lapse_email_notified'
          ? 'lapse_sms_and_email_notified'
          : 'lapse_sms_notified';

        await supabase
          .from('deals')
          .update({ status_standardized: newStatus })
          .eq('id', deal.deal_id);

        successCount++;

      } catch (error) {
        console.error(`  ❌ ERROR sending to ${deal.client_name}:`, error);
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
    console.error('\n❌ ========================================');
    console.error('❌ LAPSE REMINDERS CRON FATAL ERROR');
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

