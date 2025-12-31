import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/ai/conversations/[id]/messages - Add a message to a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, subscription_tier')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify conversation ownership
    const { data: conversation, error: convError } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userData.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const body = await request.json();
    const { role, content, tool_calls, chart_code, tokens_used } = body;

    if (!role || !['user', 'assistant'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Insert message
    const { data: message, error } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        tool_calls: tool_calls || null,
        chart_code: chart_code || null,
        tokens_used: tokens_used || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    }

    // If this is the first user message, update the conversation title
    if (role === 'user') {
      const { data: existingMessages } = await supabase
        .from('ai_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('role', 'user')
        .limit(2);

      // If this is the first user message, generate a title
      if (existingMessages && existingMessages.length === 1) {
        const title = content.length > 50
          ? content.substring(0, 50) + '...'
          : content;

        await supabase
          .from('ai_conversations')
          .update({ title })
          .eq('id', conversationId);
      }
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Add message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
