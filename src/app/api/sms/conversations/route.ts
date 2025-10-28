/**
 * Get SMS Conversations API Route
 * Returns conversations based on view mode (self, downlines, all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'downlines'; // 'all', 'self', 'downlines'

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details including admin status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, agency_id, is_admin')
      .eq('auth_user_id', user.id as any)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch conversations based on view mode

    let conversations;
    let convError;

    if (view === 'all' && (userData as any).is_admin) {
      // Admin viewing all conversations in agency - filter by agency_id directly

      const result = await supabase
        .from('conversations')
        .select(`
          *,
          deal:deal_id (
            id,
            client_name,
            client_phone,
            status,
            status_standardized
          )
        `)
        .eq('agency_id', (userData as any).agency_id)
        .eq('type', 'sms' as any)
        .eq('is_active', true as any)
        .order('last_message_at', { ascending: false });

      conversations = result.data;
      convError = result.error;
    } else if (view === 'self') {
      // Show only conversations where current user is the agent

      const result = await supabase
        .from('conversations')
        .select(`
          *,
          deal:deal_id (
            id,
            client_name,
            client_phone,
            status,
            status_standardized
          )
        `)
        .eq('agent_id', (userData as any).id)
        .eq('type', 'sms' as any)
        .eq('is_active', true as any)
        .order('last_message_at', { ascending: false });

      conversations = result.data;
      convError = result.error;
    } else {
      // Downlines only (default)
      const { data: downlineAgents, error: downlineError } = await supabase
        .rpc('get_agent_downline', { agent_id: (userData as any).id });

      if (downlineError) {
        throw downlineError;
      }

      const agentIds = ((downlineAgents || []) as any[]).map((a: any) => a.id);

      if (agentIds.length === 0) {
        return NextResponse.json({
          conversations: [],
        });
      }

      const result = await supabase
        .from('conversations')
        .select(`
          *,
          deal:deal_id (
            id,
            client_name,
            client_phone,
            status,
            status_standardized
          )
        `)
        .in('agent_id', agentIds as any)
        .eq('type', 'sms' as any)
        .eq('is_active', true as any)
        .order('last_message_at', { ascending: false });

      conversations = result.data;
      convError = result.error;
    }

    if (convError) {
      throw convError;
    }

    // Batch fetch last messages and unread counts for all conversations
    const conversationIds = (conversations as any[])?.map((c: any) => c.id) || [];

    if (conversationIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // Get last message for each conversation (much faster than loading all messages)
    const { data: lastMessages } = await supabase
      .from('messages')
      .select('conversation_id, body, sent_at')
      .in('conversation_id', conversationIds)
      .order('sent_at', { ascending: false });

    // Get unread counts efficiently
    const { data: unreadCounts } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .eq('direction', 'inbound' as any)
      .is('read_at', null);

    // Create lookup maps for O(1) access
    const lastMessageMap = new Map<string, any>();
    (lastMessages || []).forEach((msg: any) => {
      if (!lastMessageMap.has(msg.conversation_id)) {
        lastMessageMap.set(msg.conversation_id, msg);
      }
    });

    const unreadCountMap = new Map<string, number>();
    (unreadCounts || []).forEach((msg: any) => {
      const current = unreadCountMap.get(msg.conversation_id) || 0;
      unreadCountMap.set(msg.conversation_id, current + 1);
    });

    // Format conversations with last message
    const formattedConversations = (conversations as any[])?.map((conv: any) => {
      const lastMessage = lastMessageMap.get(conv.id);
      const unreadCount = unreadCountMap.get(conv.id) || 0;

      return {
        id: conv.id,
        dealId: conv.deal_id,
        clientName: conv.deal?.client_name || 'Unknown',
        clientPhone: conv.deal?.client_phone || '',
        lastMessage: lastMessage?.body || '',
        lastMessageAt: conv.last_message_at,
        unreadCount: unreadCount,
        smsOptInStatus: conv.sms_opt_in_status,
        optedInAt: conv.opted_in_at,
        optedOutAt: conv.opted_out_at,
        statusStandardized: conv.deal?.status_standardized,
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

