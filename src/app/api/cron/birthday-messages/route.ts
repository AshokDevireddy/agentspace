/**
 * Birthday Messages Cron Job
 * Runs daily at 9 AM to send birthday wishes to clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-config';
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

    // Get current date in PST (Pacific Time)
    const pstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const month = pstDate.getMonth() + 1; // JavaScript months are 0-indexed
    const day = pstDate.getDate();


    // Query deals using Django API
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/messaging/birthdays`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error querying deals:', errorData);
      throw new Error(errorData.error || 'Failed to fetch birthday deals');
    }

    const birthdayDeals = await response.json();


    if (!birthdayDeals || birthdayDeals.length === 0) {
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
    for (const deal of birthdayDeals) {
      try {

        // Check if messaging is enabled (already filtered by RPC, but double-check)
        if (!deal.messaging_enabled) {
          skippedCount++;
          continue;
        }

        // Check agent subscription tier - only Pro and Expert get automated messages
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
        if (agencySettings?.sms_birthday_enabled === false) {
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


        // Create draft message (don't send via Telnyx)
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

