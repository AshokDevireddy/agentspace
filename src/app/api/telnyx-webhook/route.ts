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
  getAgencyDetails,
  findAgencyByPhoneNumber,
} from '@/lib/sms-helpers';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Checks if message is an opt-out/help/opt-in keyword
 */
function getComplianceKeyword(messageText: string): 'STOP' | 'HELP' | 'START' | null {
  const text = messageText.trim().toUpperCase();
  if (text === 'STOP' || text === 'UNSUBSCRIBE') return 'STOP';
  if (text === 'START' || text === 'UNSTOP' || text === 'SUBSCRIBE') return 'START';
  if (text === 'HELP' || text === 'INFO') return 'HELP';
  return null;
}

/**
 * Handles opt-out (STOP) response
 */
async function handleOptOut(conversationId: string, agentId: string, clientPhone: string, toNumber: string) {
  const supabase = createAdminClient();

  // Update conversation status to opted_out
  await supabase
    .from('conversations')
    .update({
      sms_opt_in_status: 'opted_out',
      opted_out_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  // Send unsubscribe confirmation
  const unsubscribeMessage = `AgentSpace: You have been unsubscribed and will receive no further messages. For assistance, contact ashok@useagentspace.com.`;

  await sendSMS({
    from: toNumber,
    to: clientPhone,
    text: unsubscribeMessage,
  });

  // Log the unsubscribe message
  await logMessage({
    conversationId,
    senderId: agentId,
    receiverId: agentId,
    body: unsubscribeMessage,
    direction: 'outbound',
    status: 'sent',
    metadata: {
      automated: true,
      type: 'opt_out_confirmation',
      client_phone: normalizePhoneForStorage(clientPhone),
    },
  });
}

/**
 * Handles help (HELP) response
 */
async function handleHelp(conversationId: string, agentId: string, clientPhone: string, toNumber: string) {
  // Send help message
  const helpMessage = `AgentSpace: For assistance, email ashok@useagentspace.com. Visit useagentspace.com/privacy for our privacy policy and useagentspace.com/terms for terms & conditions.`;

  await sendSMS({
    from: toNumber,
    to: clientPhone,
    text: helpMessage,
  });

  // Log the help message
  await logMessage({
    conversationId,
    senderId: agentId,
    receiverId: agentId,
    body: helpMessage,
    direction: 'outbound',
    status: 'sent',
    metadata: {
      automated: true,
      type: 'help_response',
      client_phone: normalizePhoneForStorage(clientPhone),
    },
  });
}

/**
 * Handles opt-in (START) response - re-subscribes client
 */
async function handleOptIn(conversationId: string, agentId: string, agencyId: string, clientPhone: string, toNumber: string) {
  const supabase = createAdminClient();

  // Update conversation status to opted_in
  await supabase
    .from('conversations')
    .update({
      sms_opt_in_status: 'opted_in',
      opted_in_at: new Date().toISOString(),
      opted_out_at: null,
    })
    .eq('id', conversationId);

  // Get agency details for welcome message
  const agency = await getAgencyDetails(agencyId);

  // Send welcome message again
  const welcomeMessage = `Thanks for re-subscribing! You'll receive policy updates and reminders from ${agency?.name || 'AgentSpace'} by text. Reply STOP to opt out anytime.`;

  await sendSMS({
    from: toNumber,
    to: clientPhone,
    text: welcomeMessage,
  });

  // Log the welcome message
  await logMessage({
    conversationId,
    senderId: agentId,
    receiverId: agentId,
    body: welcomeMessage,
    direction: 'outbound',
    status: 'sent',
    metadata: {
      automated: true,
      type: 'opt_in_welcome',
      client_phone: normalizePhoneForStorage(clientPhone),
    },
  });
}

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

      // First, find which agency this message is for (based on the receiving phone number)
      const agency = await findAgencyByPhoneNumber(toNumber);

      if (!agency) {
        console.warn('No agency found for phone number:', toNumber);
        return NextResponse.json({
          success: false,
          message: 'Agency not found'
        });
      }

      console.log(`📞 Message received for agency: ${agency.name} (${agency.id})`);

      // Find the deal associated with this client phone number within the agency
      const deal = await findDealByClientPhone(normalizedClientPhone, agency.id);

      if (!deal) {
        console.warn('No deal found for normalized client phone:', normalizedClientPhone, '(original:', fromNumber + ')', 'in agency:', agency.id);
        return NextResponse.json({
          success: false,
          message: 'Client not found in this agency'
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

      // Check if message is a compliance keyword (STOP/HELP/START)
      const complianceKeyword = getComplianceKeyword(messageText);

      if (complianceKeyword) {
        console.log(`Received compliance keyword: ${complianceKeyword}`);

        // Log the incoming message first
        await logMessage({
          conversationId: conversation.id,
          senderId: agent.id,
          receiverId: agent.id,
          body: messageText,
          direction: 'inbound',
          status: 'received',
          metadata: {
            client_phone: normalizedClientPhone,
            telnyx_message_id: payload.id,
            compliance_keyword: complianceKeyword,
          },
        });

        // Handle the compliance keyword
        if (complianceKeyword === 'STOP') {
          await handleOptOut(conversation.id, agent.id, fromNumber, toNumber);
        } else if (complianceKeyword === 'START') {
          await handleOptIn(conversation.id, agent.id, agent.agency_id, fromNumber, toNumber);
        } else if (complianceKeyword === 'HELP') {
          await handleHelp(conversation.id, agent.id, fromNumber, toNumber);
        }

        return NextResponse.json({
          success: true,
          message: 'Compliance keyword processed'
        });
      }

      // Log regular inbound message
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

