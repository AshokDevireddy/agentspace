/**
 * Holiday Messages Cron Job
 * Runs daily at 8 AM PST to send holiday greetings to all active clients
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

    // Verify this is a cron request
    const authResult = verifyCronRequest(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Check if today is a holiday
    const holiday = getTodaysHoliday();
    if (!holiday) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'Not a holiday today',
      });
    }

    console.log(`🎊 Today is ${holiday.name}! Sending greetings...`);

    // Query deals using Django API
    const apiUrl = getApiBaseUrl();
    const response = await fetch(`${apiUrl}/api/messaging/holidays?holiday_name=${encodeURIComponent(holiday.name)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error querying deals:', errorData);
      throw new Error(errorData.error || 'Failed to fetch holiday deals');
    }

    const responseData = await response.json();
    const deals = responseData.deals || [];

    if (!deals || deals.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No eligible clients for holiday messages',
      });
    }


    const agencyIds = deals.map((d: { agency_id: string }) => d.agency_id);
    const agencySettingsMap = await batchFetchAgencySmsSettings(agencyIds);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each deal
    console.log('\n🎁 Processing holiday messages...');
    for (const deal of deals) {
      try {

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
        if (!agencySettings?.sms_holiday_enabled) {
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
        const template = agencySettings?.sms_holiday_template || DEFAULT_SMS_TEMPLATES.holiday;
        const clientFirstName = deal.client_name?.split(' ')[0] || deal.client_name || 'there';
        const agentName = `${deal.agent_first_name} ${deal.agent_last_name}`;

        const messageBody = replaceSmsPlaceholders(template, {
          client_first_name: clientFirstName,
          agent_name: agentName,
          holiday_greeting: holiday.greeting,
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
            type: 'holiday',
            holiday_name: holiday.name,
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
