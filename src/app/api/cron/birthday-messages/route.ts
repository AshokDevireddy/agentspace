/**
 * Birthday Messages Cron Job
 * Runs daily at 9 AM to send birthday wishes to clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getConversationIfExists,
} from '@/lib/sms-helpers';
import { replaceSmsPlaceholders, DEFAULT_SMS_TEMPLATES, formatBeneficiaries, formatAgentName } from '@/lib/sms-template-helpers';
import { batchFetchAgencySmsSettings } from '@/lib/sms-template-helpers.server';
import { sendOrCreateDraft, batchFetchAutoSendSettings, batchFetchAgentAutoSendStatus } from '@/lib/sms-auto-send';
import { formatPhoneForDisplay } from '@/lib/telnyx';

export async function GET(request: NextRequest) {
  try {
    console.log('🎂 ========================================');
    console.log('🎂 BIRTHDAY MESSAGES CRON STARTED');
    console.log('🎂 ========================================');

    // Verify this is a cron request (optional - Vercel adds this header)
    const authHeader = request.headers.get('authorization');
    console.log('🔐 Auth header:', authHeader ? 'Present' : 'Not present');
    console.log('🔐 CRON_SECRET set:', process.env.CRON_SECRET ? 'Yes' : 'No');

    // CRON_SECRET is required for security - must be configured
    if (!process.env.CRON_SECRET) {
      console.log('❌ Unauthorized - CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error - CRON_SECRET not set' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ Unauthorized - CRON_SECRET mismatch');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('✅ Authorization passed');

    const supabase = createAdminClient();

    // Date filtering is now handled per-agency timezone in the RPC
    console.log(`📅 Current time (UTC): ${new Date().toISOString()}`);
    console.log(`📅 Birthday matching uses per-agency timezone (RPC-level)`);

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
    const agentIds = birthdayDeals.map((d: { agent_id: string }) => d.agent_id);
    const [agencySettingsMap, autoSendSettingsMap, agentAutoSendMap] = await Promise.all([
      batchFetchAgencySmsSettings(agencyIds),
      batchFetchAutoSendSettings(agencyIds),
      batchFetchAgentAutoSendStatus(agentIds),
    ]);

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

        // Fetch additional deal data for template variables
        const { data: dealDetails } = await supabase
          .from('deals')
          .select('monthly_premium, policy_effective_date, face_value, policy_number, carrier_id, agent_id')
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

        // Format agent name and fetch phone number
        const agentName = formatAgentName(deal.agent_first_name, deal.agent_last_name);
        const { data: agent } = await supabase
          .from('users')
          .select('phone_number')
          .eq('id', deal.agent_id)
          .single();
        const agentPhone = formatPhoneForDisplay(agent?.phone_number);

        // Use agency template or default
        const template = agencySettings?.sms_birthday_template || DEFAULT_SMS_TEMPLATES.birthday;
        const messageText = replaceSmsPlaceholders(template, {
          client_first_name: firstName,
          agency_name: deal.agency_name,
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
          messageType: 'birthday',
          autoSendSettings: autoSendSettingsMap.get(deal.agency_id),
          agentAutoSendEnabled: agentAutoSendMap.get(deal.agent_id) ?? null,
          metadata: {
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        });

        successCount++;
        console.log(`  🎉 SUCCESS: Birthday message ${result.status === 'sent' ? 'sent' : 'created as draft'} for ${deal.client_name}`);

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

