/**
 * Send SMS API Route
 * Handles sending outbound SMS messages from agents to clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/telnyx';
import {
  getDealWithDetails,
  getOrCreateConversation,
  logMessage,
  getAgencyPhoneNumber,
} from '@/lib/sms-helpers';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, agency_id, first_name, last_name')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { dealId, message } = body;

    if (!dealId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: dealId, message' },
        { status: 400 }
      );
    }

    // Get deal details
    const deal = await getDealWithDetails(dealId);

    if (!deal.client_phone) {
      return NextResponse.json(
        { error: 'Client phone number not found in deal' },
        { status: 400 }
      );
    }

    // Get agency phone number
    const agencyPhone = await getAgencyPhoneNumber(userData.agency_id);
    if (!agencyPhone) {
      return NextResponse.json(
        { error: 'Agency phone number not configured. Please configure in Settings.' },
        { status: 400 }
      );
    }

    // Get or create conversation (using client phone to prevent duplicates)
    const conversation = await getOrCreateConversation(
      userData.id,
      dealId,
      userData.agency_id,
      deal.client_phone
    );

    // Check opt-out status before sending
    if (conversation.sms_opt_in_status === 'opted_out') {
      return NextResponse.json(
        { error: 'Client has opted out of SMS messages. Cannot send message.' },
        { status: 403 }
      );
    }

    // Note: Pending status still blocks sends, but new conversations are auto-opted-in
    if (conversation.sms_opt_in_status === 'pending') {
      return NextResponse.json(
        { error: 'Cannot send message to this conversation. Contact support if this persists.' },
        { status: 403 }
      );
    }

    // Send SMS via Telnyx
    try {
      const telnyxResponse = await sendSMS({
        from: agencyPhone,
        to: deal.client_phone,
        text: message,
      });

      // Log the message
      await logMessage({
        conversationId: conversation.id,
        senderId: userData.id,
        receiverId: userData.id, // Placeholder since client may not have user record
        body: message,
        direction: 'outbound',
        status: 'sent',
        metadata: {
          telnyx_message_id: telnyxResponse.data.id,
          client_phone: deal.client_phone,
          client_name: deal.client_name,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully',
        conversationId: conversation.id,
      });

    } catch (telnyxError: any) {
      console.error('Telnyx SMS error:', telnyxError);

      // Check if this is a STOP block error (40300)
      if (telnyxError.message && telnyxError.message.includes('40300')) {
        // Mark conversation as opted out
        const supabase = createAdminClient();
        await supabase
          .from('conversations')
          .update({
            sms_opt_in_status: 'opted_out',
            opted_out_at: new Date().toISOString(),
          })
          .eq('id', conversation.id);

        // Log the failed message
        await logMessage({
          conversationId: conversation.id,
          senderId: userData.id,
          receiverId: userData.id,
          body: message,
          direction: 'outbound',
          status: 'failed',
          metadata: {
            error: 'Client has blocked messages (STOP)',
            error_code: '40300',
            client_phone: deal.client_phone,
            client_name: deal.client_name,
          },
        });

        return NextResponse.json(
          { error: 'Client has blocked messages. They previously sent STOP to unsubscribe.' },
          { status: 403 }
        );
      }

      // For other Telnyx errors, throw to be caught by outer handler
      throw telnyxError;
    }

  } catch (error) {
    console.error('Send SMS error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send SMS'
      },
      { status: 500 }
    );
  }
}

