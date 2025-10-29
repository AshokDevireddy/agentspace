/**
 * Get SMS Conversations API Route
 * Returns conversations based on view mode (self, downlines, all)
 * Optimized with RPC functions for better performance
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

    // Fetch conversations using optimized RPC functions based on view mode
    let conversations;
    let convError;

    if (view === 'all' && (userData as any).is_admin) {
      // Admin viewing all conversations in agency
      const result = await supabase
        .rpc('get_sms_conversations_all', { p_user_id: (userData as any).id });

      conversations = result.data;
      convError = result.error;
    } else if (view === 'self') {
      // Show only conversations where current user is the agent
      const result = await supabase
        .rpc('get_sms_conversations_self', { p_user_id: (userData as any).id });

      conversations = result.data;
      convError = result.error;
    } else {
      // Downlines only (default)
      const result = await supabase
        .rpc('get_sms_conversations_downlines', { p_user_id: (userData as any).id });

      conversations = result.data;
      convError = result.error;
    }

    if (convError) {
      console.error('RPC error:', convError);
      throw convError;
    }

    // Format conversations - RPC functions already return the data in the right format
    const formattedConversations = (conversations as any[])?.map((conv: any) => ({
      id: conv.conversation_id,
      dealId: conv.deal_id,
      clientName: conv.client_name || 'Unknown',
      clientPhone: conv.client_phone || '',
      lastMessage: conv.last_message || '',
      lastMessageAt: conv.last_message_at,
      unreadCount: Number(conv.unread_count) || 0,
      smsOptInStatus: conv.sms_opt_in_status,
      optedInAt: conv.opted_in_at,
      optedOutAt: conv.opted_out_at,
      statusStandardized: conv.status_standardized,
    }));

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

