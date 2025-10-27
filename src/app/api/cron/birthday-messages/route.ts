/**
 * Birthday Messages Cron Job
 * Runs daily at 9 AM to send birthday wishes to clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/telnyx';
import {
  getOrCreateConversation,
  logMessage,
  getAgencyPhoneNumber,
} from '@/lib/sms-helpers';

export async function GET(request: NextRequest) {
  try {
    console.log('🎂 ========================================');
    console.log('🎂 BIRTHDAY MESSAGES CRON STARTED');
    console.log('🎂 ========================================');

    // Verify this is a cron request (optional - Vercel adds this header)
    const authHeader = request.headers.get('authorization');
    console.log('🔐 Auth header:', authHeader ? 'Present' : 'Not present');
    console.log('🔐 CRON_SECRET set:', process.env.CRON_SECRET ? 'Yes' : 'No');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // If CRON_SECRET is set, verify it. Otherwise allow the request
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

    // Get current date in PST (Pacific Time)
    const pstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const month = pstDate.getMonth() + 1; // JavaScript months are 0-indexed
    const day = pstDate.getDate();

    console.log(`📅 Current time (UTC): ${new Date().toISOString()}`);
    console.log(`📅 Current date (PST): ${pstDate.toLocaleDateString('en-US')} - ${month}/${day}`);
    console.log(`📅 Looking for birthdays on: ${month}/${day}`);

    // Query deals where date_of_birth matches today's month and day
    console.log('🔍 Querying deals with date_of_birth...');
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        id,
        client_name,
        client_phone,
        date_of_birth,
        agent_id,
        agent:agent_id (
          id,
          first_name,
          last_name,
          agency_id,
          agency:agency_id (
            id,
            name,
            phone_number,
            messaging_enabled
          )
        )
      `)
      .eq('status', 'active')
      .not('client_phone', 'is', null)
      .not('date_of_birth', 'is', null);

    if (dealsError) {
      console.error('❌ Error querying deals:', dealsError);
      throw dealsError;
    }

    console.log(`📊 Total deals with birthdays: ${deals?.length || 0}`);

    if (!deals || deals.length === 0) {
      console.log('⚠️  No deals with birthdays found in database');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No birthdays today',
      });
    }

    // Log all birthdays found for debugging
    console.log('📋 All deals with birthdays:');
    deals.forEach((deal, index) => {
      const dob = new Date(deal.date_of_birth);
      // Convert to PST for comparison
      const dobPST = new Date(dob.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      console.log(`  ${index + 1}. ${deal.client_name} - DOB: ${deal.date_of_birth} (PST: ${dobPST.getMonth() + 1}/${dobPST.getDate()})`);
    });

    // Filter deals where birthday matches today (in PST)
    const birthdayDeals = deals.filter(deal => {
      if (!deal.date_of_birth) return false;
      const dob = new Date(deal.date_of_birth);
      // Convert DOB to PST for comparison
      const dobPST = new Date(dob.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const matches = dobPST.getMonth() + 1 === month && dobPST.getDate() === day;
      console.log(`  Checking ${deal.client_name}: ${dobPST.getMonth() + 1}/${dobPST.getDate()} vs ${month}/${day} = ${matches ? '✅' : '❌'}`);
      return matches;
    });

    console.log(`🎉 Found ${birthdayDeals.length} clients with birthdays TODAY`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Send birthday messages
    console.log('\n💌 Processing birthday messages...');
    for (const deal of birthdayDeals) {
      try {
        console.log(`\n📬 Processing: ${deal.client_name} (${deal.client_phone})`);

        const agent = deal.agent;
        const agency = agent?.agency;

        console.log(`  Agent: ${agent?.first_name} ${agent?.last_name} (ID: ${agent?.id})`);
        console.log(`  Agency: ${agency?.name} (Phone: ${agency?.phone_number})`);

        if (!agent || !agency?.phone_number) {
          console.warn(`  ⚠️  Skipping: Missing agent or agency phone`);
          errorCount++;
          continue;
        }

        // Check if messaging is enabled for this agency
        if (!agency.messaging_enabled) {
          console.log(`  ⚠️  SKIPPED: Messaging is disabled for agency ${agency.name}`);
          skippedCount++;
          continue;
        }

        // Get or create conversation (using client phone to prevent duplicates)
        console.log(`  🔍 Getting/creating conversation...`);
        const conversation = await getOrCreateConversation(
          agent.id,
          deal.id,
          agent.agency_id,
          deal.client_phone
        );
        console.log(`  📞 Conversation ID: ${conversation.id}`);
        console.log(`  📱 SMS Opt-in Status: ${conversation.sms_opt_in_status}`);

        // Check opt-in status - only send to opted-in clients
        if (conversation.sms_opt_in_status !== 'opted_in') {
          console.log(`  ❌ SKIPPED: Client has not opted in (status: ${conversation.sms_opt_in_status})`);
          skippedCount++;
          continue;
        }

        // Get first name from client_name
        const firstName = deal.client_name.split(' ')[0];
        const messageText = `Happy Birthday, ${firstName}! Wishing you a great year ahead from your friends at ${agency.name}.`;

        console.log(`  📝 Message: "${messageText}"`);
        console.log(`  📤 Sending from ${agency.phone_number} to ${deal.client_phone}...`);

        // Send SMS
        await sendSMS({
          from: agency.phone_number,
          to: deal.client_phone,
          text: messageText,
        });
        console.log(`  ✅ SMS sent successfully!`);

        // Log the message
        console.log(`  💾 Logging message to database...`);
        await logMessage({
          conversationId: conversation.id,
          senderId: agent.id,
          receiverId: agent.id, // Placeholder
          body: messageText,
          direction: 'outbound',
          status: 'sent',
          metadata: {
            automated: true,
            type: 'birthday',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        });
        console.log(`  💾 Message logged successfully!`);

        successCount++;
        console.log(`  🎉 SUCCESS: Birthday message sent to ${deal.client_name}`);

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

