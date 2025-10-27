/**
 * Lapse Reminders Cron Job
 * Runs every 2 hours to notify clients about pending policy lapses
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
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.CRON_SECRET) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const supabase = createAdminClient();

    console.log('Running lapse reminders cron');

    // Query deals with status_standardized = 'lapse_pending'
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        id,
        client_name,
        client_phone,
        status_standardized,
        agent_id,
        agent:agent_id (
          id,
          first_name,
          last_name,
          phone_number,
          agency_id,
          agency:agency_id (
            id,
            name,
            phone_number,
            messaging_enabled
          )
        )
      `)
      .eq('status_standardized', 'lapse_pending')
      .not('client_phone', 'is', null);

    if (dealsError) {
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('No policies with lapse_pending status found');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No lapse pending policies',
      });
    }

    console.log(`Found ${deals.length} policies with lapse_pending status`);

    let successCount = 0;
    let errorCount = 0;

    // Send lapse reminders
    for (const deal of deals) {
      try {
        const agent = deal.agent;
        const agency = agent?.agency;

        if (!agent || !agency?.phone_number) {
          console.warn(`Skipping deal ${deal.id}: Missing agent or agency phone`);
          errorCount++;
          continue;
        }

        // Check if messaging is enabled for this agency
        if (!agency.messaging_enabled) {
          console.log(`Skipping deal ${deal.id}: Messaging is disabled for agency ${agency.name}`);
          errorCount++;
          continue;
        }

        // Get or create conversation (using client phone to prevent duplicates)
        const conversation = await getOrCreateConversation(
          agent.id,
          deal.id,
          agent.agency_id,
          deal.client_phone
        );

        // Check opt-in status - only send to opted-in clients
        if (conversation.sms_opt_in_status !== 'opted_in') {
          console.log(`Skipping deal ${deal.id}: Client has not opted in (status: ${conversation.sms_opt_in_status})`);
          errorCount++;
          continue;
        }

        const agentName = `${agent.first_name} ${agent.last_name}`;
        const agentPhone = agent.phone_number || 'your agent';
        const clientFirstName = deal.client_name.split(' ')[0]; // Extract first name

        const messageText = `Hi ${clientFirstName}, your policy is pending lapse. Your agent ${agentName} will reach out shortly at this number: ${agentPhone}`;

        // Send SMS
        await sendSMS({
          from: agency.phone_number,
          to: deal.client_phone,
          text: messageText,
        });

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
            type: 'lapse_reminder',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        });

        // Update deal status_standardized to 'lapse_notified'
        await supabase
          .from('deals')
          .update({ status_standardized: 'lapse_notified' })
          .eq('id', deal.id);

        successCount++;
        console.log(`Sent lapse reminder to ${deal.client_name}`);

      } catch (error) {
        console.error(`Failed to send lapse reminder for deal ${deal.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      total: deals.length,
    });

  } catch (error) {
    console.error('Lapse reminders cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

