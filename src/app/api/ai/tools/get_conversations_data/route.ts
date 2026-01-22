import { createServerClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/get-user-context';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get agency ID from authenticated user, not from headers
    const userContextResult = await getUserContext();
    if (!userContextResult.success) {
      return Response.json({ error: userContextResult.error }, { status: userContextResult.status });
    }
    const { agencyId } = userContextResult.context;

    const supabase = await createServerClient();
    const params = await request.json();

    const dateRangeDays = params.date_range_days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRangeDays);

    let conversationsQuery = supabase
      .from('conversations')
      .select(`
        id,
        type,
        last_message_at,
        is_active,
        client_phone,
        sms_opt_in_status,
        agent:users!conversations_agent_id_fkey(id, first_name, last_name),
        deal:deals!conversations_deal_id_fkey(id, client_name, policy_number)
      `)
      .eq('agency_id', agencyId)
      .gte('last_message_at', startDate.toISOString());

    if (params.agent_id) {
      conversationsQuery = conversationsQuery.eq('agent_id', params.agent_id);
    }

    const { data: conversations, error: convError } = await conversationsQuery;

    if (convError) {
      console.error('Error fetching conversations:', convError);
      return Response.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    // Get message counts
    let messagesData = null;
    if (params.include_messages && conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id);

      const { data: messages } = await supabase
        .from('messages')
        .select('id, conversation_id, direction, sent_at, body')
        .in('conversation_id', conversationIds)
        .gte('sent_at', startDate.toISOString())
        .order('sent_at', { ascending: false })
        .limit(100);

      messagesData = messages;
    }

    // Calculate summary
    const totalConversations = conversations?.length || 0;
    const activeConversations = conversations?.filter(c => c.is_active).length || 0;
    const optedInCount = conversations?.filter(c => c.sms_opt_in_status === 'opted_in').length || 0;

    return Response.json({
      conversations: conversations,
      messages: messagesData,
      summary: {
        total_conversations: totalConversations,
        active_conversations: activeConversations,
        opted_in_clients: optedInCount,
        date_range_days: dateRangeDays
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

