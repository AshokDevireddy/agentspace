/**
 * Telnyx Webhook Handler
 * Receives inbound SMS messages from Telnyx and processes them
 *
 * Fully migrated to use Django API endpoints.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, containsUrgentKeywords, normalizePhoneNumber, normalizePhoneForStorage } from '@/lib/telnyx';
import {
  findDealByClientPhone,
  getOrCreateConversation,
  logMessage,
  getAgencyDetails,
  findAgencyByPhoneNumber,
  updateConversationOptStatus,
  getAgentDetails,
  type DealResult,
} from '@/lib/sms-helpers';

/**
 * Verifies Telnyx webhook signature to ensure requests are authentic.
 * Telnyx uses HMAC-SHA256 signatures.
 *
 * @see https://developers.telnyx.com/docs/v2/development/api-guide/webhooks
 */
function verifyTelnyxSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const telnyxPublicKey = process.env.TELNYX_PUBLIC_KEY;

  // If no public key configured, log warning and skip verification in development
  if (!telnyxPublicKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('TELNYX_PUBLIC_KEY not configured - rejecting webhook');
      return false;
    }
    console.warn('TELNYX_PUBLIC_KEY not configured - skipping signature verification (DEV ONLY)');
    return true;
  }

  if (!signature || !timestamp) {
    console.error('Missing Telnyx signature or timestamp headers');
    return false;
  }

  try {
    // Telnyx signature verification
    // The signature is computed as: HMAC-SHA256(timestamp + "." + payload, signing_secret)
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = createHmac('sha256', telnyxPublicKey)
      .update(signedPayload)
      .digest('hex');

    // Use timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Error verifying Telnyx signature:', error);
    return false;
  }
}

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
 * Uses Django API to update conversation status
 */
async function handleOptOut(conversationId: string, agentId: string, clientPhone: string, toNumber: string) {
  // Update conversation status to opted_out via Django API
  await updateConversationOptStatus(conversationId, 'opted_out');

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
 * Uses Django API to update conversation status
 */
async function handleOptIn(conversationId: string, agentId: string, agencyId: string, clientPhone: string, toNumber: string) {
  // Update conversation status to opted_in via Django API
  await updateConversationOptStatus(conversationId, 'opted_in');

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
    // Get the raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature before processing
    const telnyxSignature = request.headers.get('telnyx-signature-ed25519');
    const telnyxTimestamp = request.headers.get('telnyx-timestamp');

    if (!verifyTelnyxSignature(rawBody, telnyxSignature, telnyxTimestamp)) {
      console.error('Telnyx webhook signature verification failed');
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);

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

      // AI Processing - fail silently if errors occur
      try {
        // Import AI processing function
        const { processAIMessage } = await import('@/lib/ai-sms-agent');
        const { getConversationIfExists, getAgentDetails } = await import('@/lib/sms-helpers');

        // Only process if conversation exists (conservative approach)
        const existingConversation = await getConversationIfExists(
          agent.id,
          deal.id,
          agent.agency_id,
          normalizedClientPhone
        );

        if (existingConversation) {
          // Fetch complete agent data for AI processing via Django API
          const fullAgent = await getAgentDetails(agent.id);

          if (fullAgent) {
            const result = await processAIMessage(
              existingConversation,
              messageText,
              {
                id: fullAgent.id,
                subscription_tier: fullAgent.subscription_tier || 'free',
                agency_id: fullAgent.agency_id,
                phone_number: fullAgent.phone_number,
                first_name: fullAgent.first_name,
                last_name: fullAgent.last_name
              },
              deal
            );

            console.log('AI Processing result:', {
              success: result.success,
              action: result.action,
              reason: result.reason,
              processingTimeMs: result.processingTimeMs
            });
          }
        }
      } catch (error) {
        console.error('AI processing failed silently:', error);
        // Continue webhook processing normally - never let AI errors break the webhook
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

