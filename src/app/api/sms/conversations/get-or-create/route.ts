/**
 * Get or Create Conversation API Route
 * Checks if conversation exists for a deal, if not creates one
 * Uses the deal's agent_id (writing agent) for the conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getOrCreateConversation, getDealWithDetails } from '@/lib/sms-helpers';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const admin = createAdminClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details
    const { data: userData, error: userError } = await admin
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { dealId } = body;

    if (!dealId) {
      return NextResponse.json(
        { error: 'Missing required field: dealId' },
        { status: 400 }
      );
    }

    // Get deal details to get the writing agent's ID
    const deal = await getDealWithDetails(dealId);

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    // Check if conversation already exists for this deal
    const { data: existingConversation, error: convError } = await admin
      .from('conversations')
      .select('id')
      .eq('deal_id', dealId)
      .eq('type', 'sms')
      .eq('is_active', true)
      .maybeSingle();

    if (convError && convError.code !== 'PGRST116') {
      console.error('Error checking existing conversation:', convError);
      return NextResponse.json(
        { error: 'Failed to check conversation' },
        { status: 500 }
      );
    }

    // If conversation exists, return it
    if (existingConversation) {
      return NextResponse.json({
        exists: true,
        conversationId: existingConversation.id,
        message: 'Conversation already exists'
      });
    }

    // Conversation doesn't exist, inform the user
    return NextResponse.json({
      exists: false,
      dealId: dealId,
      agentId: deal.agent_id,
      clientName: deal.client_name,
      clientPhone: deal.client_phone,
      message: 'Conversation does not exist'
    });

  } catch (error) {
    console.error('Get or create conversation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process request'
      },
      { status: 500 }
    );
  }
}

/**
 * Create conversation endpoint (called after user confirms)
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = createAdminClient();
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
    const { data: userData, error: userError } = await admin
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { dealId, agentId } = body;

    if (!dealId || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: dealId, agentId' },
        { status: 400 }
      );
    }

    // Get deal details
    const deal = await getDealWithDetails(dealId);

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    if (!deal.client_phone) {
      return NextResponse.json(
        { error: 'Client phone number not found in deal' },
        { status: 400 }
      );
    }

    // Create conversation using the deal's agent_id (writing agent)
    const conversation = await getOrCreateConversation(
      agentId,
      dealId,
      userData.agency_id,
      deal.client_phone
    );

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      message: 'Conversation created successfully'
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create conversation'
      },
      { status: 500 }
    );
  }
}
