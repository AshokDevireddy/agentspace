/**
 * Get SMS Conversations API Route
 * Returns all conversations for the authenticated agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all conversations for this agent
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        deal:deal_id (
          id,
          client_name,
          client_phone,
          status
        ),
        messages (
          id,
          body,
          direction,
          sent_at,
          status
        )
      `)
      .eq('agent_id', userData.id)
      .eq('type', 'sms')
      .eq('is_active', true)
      .order('last_message_at', { ascending: false });

    if (convError) {
      throw convError;
    }

    // Format conversations with last message
    const formattedConversations = conversations?.map(conv => {
      const messages = Array.isArray(conv.messages) ? conv.messages : [];
      const lastMessage = messages.length > 0
        ? messages.sort((a: any, b: any) =>
            new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
          )[0]
        : null;

      return {
        id: conv.id,
        dealId: conv.deal_id,
        clientName: conv.deal?.client_name || 'Unknown',
        clientPhone: conv.deal?.client_phone || '',
        lastMessage: lastMessage?.body || '',
        lastMessageAt: conv.last_message_at,
        unreadCount: 0, // TODO: Implement unread tracking
      };
    });

    return NextResponse.json({
      conversations: formattedConversations || [],
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch conversations'
      },
      { status: 500 }
    );
  }
}

