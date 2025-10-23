/**
 * Telnyx Webhook Handler
 * Receives inbound SMS messages from Telnyx and processes them
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, containsUrgentKeywords, normalizePhoneNumber, normalizePhoneForStorage } from '@/lib/telnyx';
import {
  findDealByClientPhone,
  getOrCreateConversation,
  logMessage,
} from '@/lib/sms-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Telnyx sends a test webhook on setup
    if (body.data?.event_type === 'message.received') {
      const payload = body.data.payload;

      const fromNumber = payload.from.phone_number;
      const toNumber = payload.to[0].phone_number;
      const messageText = payload.text;

      // Normalize phone number for storage (remove +1 prefix to match deals table format)
      const normalizedClientPhone = normalizePhoneForStorage(fromNumber);

      console.log('Received inbound SMS:', {
        fromNumber,
        normalizedClientPhone,
        toNumber,
        messageText
      });

      // Find the deal associated with this client phone number
      const deal = await findDealByClientPhone(normalizedClientPhone);

      if (!deal) {
        console.warn('No deal found for client phone:', fromNumber);
        return NextResponse.json({
          success: false,
          message: 'Client not found'
        });
      }

      const agent = deal.agent;
      if (!agent || !agent.agency_id) {
        console.warn('No agent or agency found for deal:', deal.id);
        return NextResponse.json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Get or create conversation (using normalized phone to prevent duplicates)
      const conversation = await getOrCreateConversation(
        agent.id,
        deal.id,
        agent.agency_id,
        normalizedClientPhone
      );

      // Create a client_id if it exists in the deal, otherwise use null
      // For messages, we need sender to be the client (but clients may not have user records)
      // We'll use the agent as sender for automated messages, and create a placeholder for client messages
      // For now, we'll use agent.id as both sender and receiver, and track direction

      // Actually, let's handle this differently:
      // If client_id exists in deal, use it. Otherwise, skip sender_id requirement
      // But the schema requires sender_id and receiver_id
      // Let's use agent.id for receiver and agent.id for sender temporarily
      // This is a limitation - ideally clients should have user records

      // For now, let's use the agent_id as a placeholder since the schema requires it
      // In the metadata, we'll store the actual client phone
      await logMessage({
        conversationId: conversation.id,
        senderId: agent.id, // Placeholder - using agent as sender
        receiverId: agent.id, // Agent is the receiver
        body: messageText,
        direction: 'inbound',
        status: 'received',
        metadata: {
          client_phone: normalizedClientPhone,
          telnyx_message_id: payload.id,
        },
      });

      // Check if message contains urgent keywords
      if (containsUrgentKeywords(messageText)) {
        console.log('Urgent keywords detected, forwarding to agent');

        if (agent.phone_number) {
          try {
            // Forward the message to the agent
            const forwardText = `URGENT: Client ${deal.client_name} says: "${messageText}"`;

            await sendSMS({
              from: toNumber, // Agency phone number
              to: agent.phone_number,
              text: forwardText,
            });

            console.log('Forwarded urgent message to agent:', agent.phone_number);
          } catch (error) {
            console.error('Failed to forward message to agent:', error);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Message processed'
      });
    }

    // Handle other webhook event types if needed
    return NextResponse.json({
      success: true,
      message: 'Event received'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Telnyx webhook endpoint is active'
  });
}

