/**
 * Get SMS Messages API Route
 * Returns all messages for a specific conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Check if user has access to a conversation
 * Returns true if:
 * - User is admin in the same agency
 * - User is the agent on the conversation
 * - Conversation's agent is a downline of the user
 */
async function checkConversationAccess(
  supabase: any,
  userId: string,
  userAgencyId: string,
  isAdmin: boolean,
  conversationAgentId: string,
  conversationAgencyId: string
): Promise<boolean> {
  // Admin in same agency
  if (isAdmin && userAgencyId === conversationAgencyId) {
    return true;
  }

  // User is the agent on the conversation
  if (userId === conversationAgentId) {
    return true;
  }

  // Check if conversation's agent is a downline of current user
  const { data: downlines, error } = await supabase
    .rpc('get_agent_downline', { agent_id: userId });

  if (error) {
    console.error('Error checking downlines:', error);
    return false;
  }

  const isDownline = (downlines || []).some((agent: any) => agent.id === conversationAgentId);
  return isDownline;
}

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

    // Get conversationId from query params
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId parameter' },
        { status: 400 }
      );
    }

    // Get the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, agent_id, agency_id')
      .eq('id', conversationId as any)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this conversation
    const hasAccess = await checkConversationAccess(
      supabase,
      (userData as any).id,
      (userData as any).agency_id,
      (userData as any).is_admin,
      (conversation as any).agent_id,
      (conversation as any).agency_id
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this conversation' },
        { status: 403 }
      );
    }

    // Get all messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId as any)
      .order('sent_at', { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    // Mark all unread inbound messages as read
    const unreadMessageIds = messages
      ?.filter((msg: any) => msg.direction === 'inbound' && !msg.read_at)
      .map((msg: any) => msg.id) || [];

    if (unreadMessageIds.length > 0) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() } as any)
        .in('id', unreadMessageIds as any);
    }

    return NextResponse.json({
      messages: messages || [],
    });

  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      },
      { status: 500 }
    );
  }
}

