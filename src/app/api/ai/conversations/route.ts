import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/ai/conversations - List user's conversations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, agency_id, subscription_tier')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check Expert tier
    if (userData.subscription_tier !== 'expert') {
      return NextResponse.json({
        error: 'Expert tier required',
        message: 'AI Mode is only available with Expert tier subscription.'
      }, { status: 403 });
    }

    // Get user's conversations
    const { data: conversations, error } = await supabase
      .from('ai_conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at
      `)
      .eq('user_id', userData.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ai/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, agency_id, subscription_tier')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check Expert tier
    if (userData.subscription_tier !== 'expert') {
      return NextResponse.json({
        error: 'Expert tier required',
        message: 'AI Mode is only available with Expert tier subscription.'
      }, { status: 403 });
    }

    const body = await request.json();
    const title = body.title || 'New Conversation';

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: userData.id,
        agency_id: userData.agency_id,
        title: title
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
