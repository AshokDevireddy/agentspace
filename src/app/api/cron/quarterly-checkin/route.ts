/**
 * Quarterly Check-in Cron Job
 * Runs daily at 8 AM PST to send quarterly review messages (every 90 days from policy effective date)
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
      .rpc('get_quarterly_checkin_deals');

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No quarterly check-ins due',
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
        console.log(`  Policy Effective: ${deal.policy_effective_date}`);
        console.log(`  Days Since Effective: ${deal.days_since_effective}`);
        console.log(`  Agent Phone: ${deal.agent_phone}`);

        if (!deal.messaging_enabled) {
          skippedCount++;
          continue;
        }

        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          skippedCount++;
          continue;
        }

        // Get agency settings for this deal
        const agencySettings = agencySettingsMap.get(deal.agency_id);
        if (!agencySettings?.sms_quarterly_enabled) {
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

        // Get template and replace placeholders
        const template = agencySettings?.sms_quarterly_template || DEFAULT_SMS_TEMPLATES.quarterly;
        const clientFirstName = deal.client_name?.split(' ')[0] || deal.client_name || 'there';
        const agentName = `${deal.agent_first_name} ${deal.agent_last_name}`;
        const agentPhone = deal.agent_phone || deal.agency_phone || 'your agent';

        const messageBody = replaceSmsPlaceholders(template, {
          client_first_name: clientFirstName,
          agent_name: agentName,
          agent_phone: agentPhone,
        });


        // Create draft message
        await logMessage({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id,
          body: messageBody,
          direction: 'outbound',
          status: 'draft',
          metadata: {
            automated: true,
            type: 'quarterly_checkin',
            days_since_effective: deal.days_since_effective,
            policy_effective_date: deal.policy_effective_date,
            client_phone: deal.client_phone,
            client_name: deal.client_name,
            deal_id: deal.deal_id,
          },
        });

        successCount++;
      } catch (dealError) {
        console.error(`  ❌ Error processing deal ${deal.deal_id}:`, dealError);
        errorCount++;
      }
    }

    console.log('\n📋 ========================================');
    console.log(`📋 QUARTERLY CHECK-IN COMPLETE`);
    console.log(`📋 Success: ${successCount}`);
    console.log(`📋 Skipped: ${skippedCount}`);
    console.log(`📋 Errors: ${errorCount}`);
    console.log('📋 ========================================\n');

    return NextResponse.json({
      success: true,
      sent: successCount,
      skipped: skippedCount,
      errors: errorCount,
    });
  } catch (err: any) {
    console.error('❌ Fatal error in quarterly check-in cron:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send quarterly check-in messages' },
      { status: 500 }
    );
  }
}
