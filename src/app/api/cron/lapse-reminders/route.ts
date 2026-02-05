/**
 * Lapse Reminders Cron Job
 * Runs every 2 hours to notify clients about pending policy lapses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getConversationIfExists,
} from '@/lib/sms-helpers';
import { replaceSmsPlaceholders, DEFAULT_SMS_TEMPLATES, formatBeneficiaries, formatAgentName } from '@/lib/sms-template-helpers';
import { batchFetchAgencySmsSettings } from '@/lib/sms-template-helpers.server';
import { sendOrCreateDraft, batchFetchAutoSendSettings } from '@/lib/sms-auto-send';
import { formatPhoneForDisplay } from '@/lib/telnyx';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request - CRON_SECRET is required
    const authHeader = request.headers.get('authorization');

    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Server configuration error - CRON_SECRET not set' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    console.log('Running lapse reminders cron');

    // Query deals using RPC function
    console.log('🔍 Querying deals using RPC function...');
    const { data: deals, error: dealsError } = await supabase
      .rpc('get_lapse_reminder_deals');

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('No policies eligible for lapse reminders found');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No deals eligible for lapse reminders',
      });
    }

    console.log(`Found ${deals.length} policies eligible for lapse reminders`);

    const agencyIds = deals.map((d: { agency_id: string }) => d.agency_id);
    const [agencySettingsMap, autoSendSettingsMap] = await Promise.all([
      batchFetchAgencySmsSettings(agencyIds),
      batchFetchAutoSendSettings(agencyIds),
    ]);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Send lapse reminders
    console.log('\n💌 Processing lapse reminders...');
    for (const deal of deals) {
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
        // For Free/Basic tiers, skip both draft creation AND status update
        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          console.log(`  ⏭️  SKIPPED: Agent is on ${deal.agent_subscription_tier} tier (automated messaging restricted to Pro/Expert only)`);
          console.log(`  ℹ️  Status remains unchanged (not updating to 'lapse_notified')`);
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
        if (agencySettings?.sms_lapse_reminder_enabled === false) {
          console.log(`  ⏭️  SKIPPED: Lapse reminder SMS disabled for agency`);
          skippedCount++;
          continue;
        }

        const agentName = formatAgentName(deal.agent_first_name, deal.agent_last_name);
        
        // Fetch agent phone number from users table
        const { data: agent } = await supabase
          .from('users')
          .select('phone_number')
          .eq('id', deal.agent_id)
          .single();
        const agentPhone = formatPhoneForDisplay(agent?.phone_number);
        const clientFirstName = deal.client_name.split(' ')[0]; // Extract first name

        // Fetch additional deal data for template variables
        const { data: dealDetails } = await supabase
          .from('deals')
          .select('monthly_premium, policy_effective_date, face_value, policy_number, carrier_id')
          .eq('id', deal.deal_id)
          .single();

        const insured = deal.client_name || '';
        const policyNumber = dealDetails?.policy_number || '';
        const faceAmount = dealDetails?.face_value ? `$${dealDetails.face_value.toLocaleString()}` : '';
        const monthlyPremium = dealDetails?.monthly_premium ? `$${dealDetails.monthly_premium.toFixed(2)}` : '';
        const initialDraft = dealDetails?.policy_effective_date || '';

        // Fetch carrier name
        let carrierName = '';
        if (dealDetails?.carrier_id) {
          const { data: carrier } = await supabase
            .from('carriers')
            .select('name')
            .eq('id', dealDetails.carrier_id)
            .single();
          carrierName = carrier?.name || '';
        }

        // Fetch beneficiaries
        const { data: beneficiaries } = await supabase
          .from('beneficiaries')
          .select('first_name, last_name')
          .eq('deal_id', deal.deal_id);
        const beneficiariesList = formatBeneficiaries(beneficiaries);

        // Use agency template or default
        const template = agencySettings?.sms_lapse_reminder_template || DEFAULT_SMS_TEMPLATES.lapse_reminder;
        const messageText = replaceSmsPlaceholders(template, {
          client_first_name: clientFirstName,
          agent_name: agentName,
          agent_phone: agentPhone,
          insured,
          policy_number: policyNumber,
          face_amount: faceAmount,
          monthly_premium: monthlyPremium,
          initial_draft: initialDraft,
          carrier_name: carrierName,
          beneficiaries: beneficiariesList,
        });

        console.log(`  📝 Message: "${messageText}"`);

        const result = await sendOrCreateDraft({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id,
          messageText,
          agencyPhone: deal.agency_phone,
          clientPhone: deal.client_phone,
          messageType: 'lapse',
          autoSendSettings: autoSendSettingsMap.get(deal.agency_id),
          metadata: {
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        });

        console.log(`  💾 Message ${result.status === 'sent' ? 'sent' : 'created as draft'} successfully!`);

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
        console.log(`  🎉 SUCCESS: Lapse reminder created as draft for ${deal.client_name}`);

      } catch (error) {
        console.error(`  ❌ ERROR sending to ${deal.client_name}:`, error);
        errorCount++;
      }
    }

    console.log('\n⚠️  ========================================');
    console.log('⚠️  LAPSE REMINDERS CRON COMPLETED');
    console.log('⚠️  ========================================');
    console.log(`✅ Sent: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📊 Total: ${deals.length}`);
    console.log('⚠️  ========================================\n');

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

