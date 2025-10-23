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
    // Verify this is a cron request (optional - Vercel adds this header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // If CRON_SECRET is set, verify it. Otherwise allow the request
      if (process.env.CRON_SECRET) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const supabase = createAdminClient();
    const today = new Date();
    const month = today.getMonth() + 1; // JavaScript months are 0-indexed
    const day = today.getDate();

    console.log(`Running birthday messages cron for ${month}/${day}`);

    // Query deals where date_of_birth matches today's month and day
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
            phone_number
          )
        )
      `)
      .eq('status', 'active')
      .not('client_phone', 'is', null)
      .not('date_of_birth', 'is', null);

    if (dealsError) {
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('No deals with birthdays found');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No birthdays today',
      });
    }

    // Filter deals where birthday matches today
    const birthdayDeals = deals.filter(deal => {
      if (!deal.date_of_birth) return false;
      const dob = new Date(deal.date_of_birth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    console.log(`Found ${birthdayDeals.length} clients with birthdays today`);

    let successCount = 0;
    let errorCount = 0;

    // Send birthday messages
    for (const deal of birthdayDeals) {
      try {
        const agent = deal.agent;
        const agency = agent?.agency;

        if (!agent || !agency?.phone_number) {
          console.warn(`Skipping deal ${deal.id}: Missing agent or agency phone`);
          errorCount++;
          continue;
        }

        // Get first name from client_name
        const firstName = deal.client_name.split(' ')[0];
        const messageText = `Happy Birthday, ${firstName}! Wishing you a great year ahead from your friends at ${agency.name}.`;

        // Send SMS
        await sendSMS({
          from: agency.phone_number,
          to: deal.client_phone,
          text: messageText,
        });

        // Get or create conversation (using client phone to prevent duplicates)
        const conversation = await getOrCreateConversation(
          agent.id,
          deal.id,
          agent.agency_id,
          deal.client_phone
        );

        // Log the message
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

        successCount++;
        console.log(`Sent birthday message to ${deal.client_name}`);

      } catch (error) {
        console.error(`Failed to send birthday message for deal ${deal.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      total: birthdayDeals.length,
    });

  } catch (error) {
    console.error('Birthday messages cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

