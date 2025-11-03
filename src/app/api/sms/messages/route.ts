/**
 * Get SMS Messages API Route
 * Returns all messages for a specific conversation
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

    const { data: messages, error: rpcError } = await supabase.rpc('get_conversation_messages', {
      p_user_id: (userData as any).id,
      p_conversation_id: conversationId
    });

    if (rpcError) {
      console.error('get_conversation_messages RPC error:', rpcError);
      const status = rpcError.message?.toLowerCase().includes('unauthorized') ? 403 : 500;
      return NextResponse.json(
        { error: rpcError.message },
        { status }
      );
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

