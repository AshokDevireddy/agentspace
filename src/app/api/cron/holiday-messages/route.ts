/**
 * Holiday Messages Cron Job
 * Runs daily at 8 AM PST to send holiday greetings to all active clients
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

// US Federal Bank Holidays configuration
const HOLIDAYS = [
  { date: '01-01', name: "New Year's Day", greeting: "Happy New Year" },
  { date: '01-20', name: "Martin Luther King Jr. Day", greeting: "Happy Martin Luther King Jr. Day", week: 3, weekday: 1 }, // 3rd Monday of January
  { date: '02-17', name: "Presidents' Day", greeting: "Happy Presidents' Day", week: 3, weekday: 1 }, // 3rd Monday of February
  { date: '05-26', name: "Memorial Day", greeting: "Happy Memorial Day", week: -1, weekday: 1 }, // Last Monday of May
  { date: '06-19', name: "Juneteenth", greeting: "Happy Juneteenth" },
  { date: '07-04', name: "Independence Day", greeting: "Happy 4th of July" },
  { date: '09-01', name: "Labor Day", greeting: "Happy Labor Day", week: 1, weekday: 1 }, // 1st Monday of September
  { date: '10-13', name: "Columbus Day / Indigenous Peoples' Day", greeting: "Happy Columbus Day", week: 2, weekday: 1 }, // 2nd Monday of October
  { date: '11-11', name: "Veterans Day", greeting: "Happy Veterans Day" },
  { date: '11-27', name: "Thanksgiving Day", greeting: "Happy Thanksgiving", week: 4, weekday: 4 }, // 4th Thursday of November
  { date: '12-25', name: "Christmas Day", greeting: "Merry Christmas" },
];

// Helper to calculate nth weekday of month
function getNthWeekdayOfMonth(year: number, month: number, nth: number, weekday: number): Date | null {
  if (nth === -1) {
    // Last occurrence - start from end of month and work backwards
    const lastDay = new Date(year, month + 1, 0); // Last day of month
    for (let day = lastDay.getDate(); day >= 1; day--) {
      const date = new Date(year, month, day);
      if (date.getDay() === weekday) {
        return date;
      }
    }
    return null;
  }

  // Find nth occurrence from beginning
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();

  let daysUntilFirst = weekday - firstWeekday;
  if (daysUntilFirst < 0) daysUntilFirst += 7;

  const nthOccurrence = new Date(year, month, 1 + daysUntilFirst + (nth - 1) * 7);

  // Verify still in same month
  if (nthOccurrence.getMonth() !== month) return null;

  return nthOccurrence;
}

// Get today's holiday if any
function getTodaysHoliday(): { name: string; greeting: string } | null {
  const today = new Date();
  const month = today.getMonth(); // 0-indexed
  const day = today.getDate();
  const todayStr = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Check fixed date holidays
  for (const holiday of HOLIDAYS) {
    if (!holiday.week) {
      // Fixed date holiday
      if (holiday.date === todayStr) {
        return { name: holiday.name, greeting: holiday.greeting };
      }
    } else {
      // Floating holiday (nth weekday of month)
      const holidayMonth = parseInt(holiday.date.split('-')[0], 10) - 1;
      if (month !== holidayMonth) continue;

      const year = today.getFullYear();
      const holidayDate = getNthWeekdayOfMonth(year, holidayMonth, holiday.week, holiday.weekday!);
      if (holidayDate && holidayDate.getDate() === day) {
        return { name: holiday.name, greeting: holiday.greeting };
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🎉 ========================================');
    console.log('🎉 HOLIDAY MESSAGES CRON STARTED');
    console.log('🎉 ========================================');

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

    // Check if today is a holiday
    const holiday = getTodaysHoliday();
    if (!holiday) {
      console.log('⚠️  Today is not a holiday - no messages to send');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'Not a holiday today',
      });
    }

    console.log(`🎊 Today is ${holiday.name}! Sending greetings...`);

    const supabase = createAdminClient();

    // Query deals using RPC function
    console.log('🔍 Querying deals for holiday messages...');
    const { data: deals, error: dealsError } = await supabase
      .rpc('get_holiday_message_deals', { p_holiday_name: holiday.name });

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('⚠️  No eligible deals found for holiday messages');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No eligible clients for holiday messages',
      });
    }

    console.log(`📊 Found ${deals.length} unique clients for holiday messages`);

    const agencyIds = deals.map((d: { agency_id: string }) => d.agency_id);
    const [agencySettingsMap, autoSendSettingsMap] = await Promise.all([
      batchFetchAgencySmsSettings(agencyIds),
      batchFetchAutoSendSettings(agencyIds),
    ]);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each deal
    console.log('\n🎁 Processing holiday messages...');
    for (const deal of deals) {
      try {
        console.log(`\n📬 Processing: ${deal.client_name} (${deal.client_phone})`);
        console.log(`  Agent: ${deal.agent_first_name} ${deal.agent_last_name}`);
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
        if (!agencySettings?.sms_holiday_enabled) {
          console.log(`  ⏭️  SKIPPED: Holiday messages disabled for agency`);
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
        const template = agencySettings?.sms_holiday_template || DEFAULT_SMS_TEMPLATES.holiday;
        const clientFirstName = deal.client_name?.split(' ')[0] || deal.client_name || 'there';
        const agentName = formatAgentName(deal.agent_first_name, deal.agent_last_name);

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

        // Fetch agent phone number
        const { data: agent } = await supabase
          .from('users')
          .select('phone_number')
          .eq('id', deal.agent_id)
          .single();
        const agentPhone = formatPhoneForDisplay(agent?.phone_number);

        const messageBody = replaceSmsPlaceholders(template, {
          client_first_name: clientFirstName,
          agent_name: agentName,
          agent_phone: agentPhone,
          holiday_greeting: holiday.greeting,
          insured,
          policy_number: policyNumber,
          face_amount: faceAmount,
          monthly_premium: monthlyPremium,
          initial_draft: initialDraft,
          carrier_name: carrierName,
          beneficiaries: beneficiariesList,
        });

        console.log(`  📝 Message: ${messageBody.substring(0, 50)}...`);

        const result = await sendOrCreateDraft({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id,
          messageText: messageBody,
          agencyPhone: deal.agency_phone,
          clientPhone: deal.client_phone,
          messageType: 'holiday',
          autoSendSettings: autoSendSettingsMap.get(deal.agency_id),
          metadata: {
            holiday_name: holiday.name,
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

    console.log('\n🎊 ========================================');
    console.log(`🎊 HOLIDAY MESSAGES COMPLETE`);
    console.log(`🎊 Holiday: ${holiday.name}`);
    console.log(`🎊 Success: ${successCount}`);
    console.log(`🎊 Skipped: ${skippedCount}`);
    console.log(`🎊 Errors: ${errorCount}`);
    console.log('🎊 ========================================\n');

    return NextResponse.json({
      success: true,
      sent: successCount,
      skipped: skippedCount,
      errors: errorCount,
      holiday: holiday.name,
    });
  } catch (err: any) {
    console.error('❌ Fatal error in holiday messages cron:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send holiday messages' },
      { status: 500 }
    );
  }
}
