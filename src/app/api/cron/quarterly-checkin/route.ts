/**
 * Quarterly Check-in Cron Job
 * Runs daily at 8 AM PST to send quarterly review messages (every 90 days from policy effective date)
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
    console.log('📋 ========================================');
    console.log('📋 QUARTERLY CHECK-IN CRON STARTED');
    console.log('📋 ========================================');

    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
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

    // Query deals using RPC function
    console.log('🔍 Querying deals for quarterly check-in (90-day intervals)...');
    const { data: deals, error: dealsError } = await supabase
      .rpc('get_quarterly_checkin_deals');

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('⚠️  No deals due for quarterly check-in today');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No quarterly check-ins due',
      });
    }

    console.log(`📊 Found ${deals.length} unique clients due for quarterly check-in`);

    const agencyIds = deals.map((d: { agency_id: string }) => d.agency_id);
    const agentIds = deals.map((d: { agent_id: string }) => d.agent_id);
    const [agencySettingsMap, autoSendSettingsMap, agentAutoSendMap] = await Promise.all([
      batchFetchAgencySmsSettings(agencyIds),
      batchFetchAutoSendSettings(agencyIds),
      batchFetchAgentAutoSendStatus(agentIds),
    ]);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each deal
    console.log('\n📞 Processing quarterly check-in messages...');
    for (const deal of deals) {
      try {
        console.log(`\n📬 Processing: ${deal.client_name} (${deal.client_phone})`);
        console.log(`  Policy Effective: ${deal.policy_effective_date}`);
        console.log(`  Days Since Effective: ${deal.days_since_effective}`);
        console.log(`  Agent: ${deal.agent_first_name} ${deal.agent_last_name}`);
        console.log(`  Agent Phone: ${deal.agent_phone}`);
        console.log(`  Agent Tier: ${deal.agent_subscription_tier}`);
        console.log(`  Agency: ${deal.agency_name}`);

        if (!deal.messaging_enabled) {
          console.log(`  ⚠️  SKIPPED: Messaging is disabled for agency ${deal.agency_name}`);
          skippedCount++;
          continue;
        }

        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          console.log(`  ⏭️  SKIPPED: Agent is on ${deal.agent_subscription_tier} tier`);
          skippedCount++;
          continue;
        }

        // Get agency settings for this deal
        const agencySettings = agencySettingsMap.get(deal.agency_id);
        if (!agencySettings?.sms_quarterly_enabled) {
          console.log(`  ⏭️  SKIPPED: Quarterly messages disabled for agency`);
          skippedCount++;
          continue;
        }

        console.log(`  🔍 Checking for existing conversation...`);
        const conversation = await getConversationIfExists(
          deal.agent_id,
          deal.deal_id,
          deal.agency_id,
          deal.client_phone
        );

        if (!conversation) {
          console.log(`  ⏭️  SKIPPED: No existing conversation found`);
          skippedCount++;
          continue;
        }

        console.log(`  📞 Conversation ID: ${conversation.id}`);
        console.log(`  📱 SMS Opt-in Status: ${conversation.sms_opt_in_status}`);

        if (conversation.sms_opt_in_status !== 'opted_in') {
          console.log(`  ⏭️  SKIPPED: Client not opted in (status: ${conversation.sms_opt_in_status})`);
          skippedCount++;
          continue;
        }

        // Get template and replace placeholders
        const template = agencySettings?.sms_quarterly_template || DEFAULT_SMS_TEMPLATES.quarterly;
        const clientFirstName = deal.client_name?.split(' ')[0] || deal.client_name || 'there';
        const agentName = formatAgentName(deal.agent_first_name, deal.agent_last_name);
        
        // Fetch agent phone number from users table
        const { data: agent } = await supabase
          .from('users')
          .select('phone_number')
          .eq('id', deal.agent_id)
          .single();
        const agentPhone = formatPhoneForDisplay(agent?.phone_number || deal.agency_phone);

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

        const messageBody = replaceSmsPlaceholders(template, {
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

        console.log(`  📝 Message: ${messageBody.substring(0, 80)}...`);

        const result = await sendOrCreateDraft({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id,
          messageText: messageBody,
          agencyPhone: deal.agency_phone,
          clientPhone: deal.client_phone,
          messageType: 'quarterly',
          autoSendSettings: autoSendSettingsMap.get(deal.agency_id),
          agentAutoSendEnabled: agentAutoSendMap.get(deal.agent_id) ?? null,
          metadata: {
            days_since_effective: deal.days_since_effective,
            policy_effective_date: deal.policy_effective_date,
            client_phone: deal.client_phone,
            client_name: deal.client_name,
            deal_id: deal.deal_id,
          },
        });

        console.log(`  ✅ Message ${result.status === 'sent' ? 'sent' : 'created as draft'} successfully`);
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
