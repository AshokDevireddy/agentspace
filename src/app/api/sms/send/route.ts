/**
 * Send SMS API Route
 * Handles sending outbound SMS messages from agents to clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
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

    // Send SMS via Telnyx
    const telnyxResponse = await sendSMS({
      from: agencyPhone,
      to: deal.client_phone,
      text: message,
    });

    // Get or create conversation
    const conversation = await getOrCreateConversation(
      userData.id,
      dealId,
      userData.agency_id
    );

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

