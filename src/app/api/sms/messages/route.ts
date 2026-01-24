/**
 * Get SMS Messages API Route
 * Returns all messages for a specific conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getSmsEndpoint } from '@/lib/api-config';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get conversationId and view from query params
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const view = searchParams.get('view') || 'downlines';

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId parameter' },
        { status: 400 }
      );
    }

    const url = new URL(getSmsEndpoint('messages'));
    url.searchParams.set('conversation_id', conversationId);
    url.searchParams.set('view', view);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Messages API error:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch messages' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      messages: data.messages || data || [],
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

