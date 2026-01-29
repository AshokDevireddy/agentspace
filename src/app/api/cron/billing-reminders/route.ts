/**
 * Billing Reminders Cron Job
 * Runs daily at 8 AM to remind clients about upcoming premium payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-config';
import {
  getConversationIfExists,
  logMessage,
} from '@/lib/sms-helpers';
import { replaceSmsPlaceholders, DEFAULT_SMS_TEMPLATES } from '@/lib/sms-template-helpers';
import { batchFetchAgencySmsSettings } from '@/lib/sms-template-helpers.server';
import { calculateNextCustomBillingDate } from '@/lib/utils';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  try {

    // Verify this is a cron request
    const authResult = verifyCronRequest(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Get dates in PST
    const todayPST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    todayPST.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(todayPST);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);


    // Query deals using Django API
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/messaging/billing-reminders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error querying deals:', errorData);
      throw new Error(errorData.error || 'Failed to fetch billing reminder deals');
    }

    const deals = await response.json();

    if (!deals || deals.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No billing reminders due',
      });
    }


    const agencyIds = deals.map((d: { agency_id: string }) => d.agency_id);
    const agencySettingsMap = await batchFetchAgencySmsSettings(agencyIds);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each deal
    for (const deal of deals) {
      try {
        let nextBillingDate: Date;
        if (deal.ssn_benefit && deal.billing_day_of_month && deal.billing_weekday) {
          const customDate = calculateNextCustomBillingDate(deal.billing_day_of_month, deal.billing_weekday);
          nextBillingDate = customDate || new Date(deal.next_billing_date);
        } else {
          nextBillingDate = new Date(deal.next_billing_date);
        }
        const nextBillingDateStr = nextBillingDate.toLocaleDateString('en-US');

        if (!deal.messaging_enabled) {
          skippedCount++;
          continue;
        }

        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          skippedCount++;
          continue;
        }

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


        if (conversation.sms_opt_in_status !== 'opted_in') {
          skippedCount++;
          continue;
        }

        const agencySettings = agencySettingsMap.get(deal.agency_id);
        if (agencySettings?.sms_billing_reminder_enabled === false) {
          skippedCount++;
          continue;
        }

        const firstName = deal.client_name.split(' ')[0];
        const template = agencySettings?.sms_billing_reminder_template || DEFAULT_SMS_TEMPLATES.billing_reminder;
        const messageText = replaceSmsPlaceholders(template, {
          client_first_name: firstName,
        });


        await logMessage({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id,
          body: messageText,
          direction: 'outbound',
          status: 'draft',
          metadata: {
            automated: true,
            type: 'billing_reminder',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
            billing_cycle: deal.billing_cycle,
            next_billing_date: nextBillingDate.toISOString(),
            ssn_benefit: deal.ssn_benefit,
            billing_pattern: deal.ssn_benefit ? `${deal.billing_day_of_month} ${deal.billing_weekday}` : null,
          },
        });

        successCount++;

      } catch (error) {
        console.error(`  ❌ ERROR sending to ${deal.client_name}:`, error);
        errorCount++;
      }
    }

    console.log('\n💰 ========================================');
    console.log('💰 BILLING REMINDERS CRON COMPLETED');
    console.log('💰 ========================================');
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

