import { getSession } from '@/lib/session';
import { getApiBaseUrl } from '@/lib/api-config';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = session.accessToken;
    const apiUrl = getApiBaseUrl();
    const params = await request.json();

    const dateRangeDays = params.date_range_days || 30;

    // Build query params for Django endpoint
    const queryParams = new URLSearchParams();
    queryParams.set('days', String(dateRangeDays));
    queryParams.set('view', 'all'); // Get all conversations for AI tools
    if (params.agent_id) {
      queryParams.set('agent_id', params.agent_id);
    }

    // Call Django conversations endpoint
    const djangoResponse = await fetch(
      `${apiUrl}/api/sms/conversations?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    if (!djangoResponse.ok) {
      const errorData = await djangoResponse.json().catch(() => ({}));
      console.error('Error fetching conversations:', errorData);
      return Response.json({ error: 'Failed to fetch conversations' }, { status: djangoResponse.status });
    }

    const djangoData = await djangoResponse.json();
    const conversations = djangoData.conversations || [];

    // Transform conversations to expected format
    const formattedConversations = conversations.map((conv: any) => ({
      id: conv.id,
      type: conv.type,
      last_message_at: conv.lastMessageAt || conv.last_message_at,
      is_active: conv.isActive ?? conv.is_active ?? true,
      client_phone: conv.clientPhone || conv.client_phone,
      sms_opt_in_status: conv.smsOptInStatus || conv.sms_opt_in_status,
      agent: conv.agent ? {
        id: conv.agent.id,
        first_name: conv.agent.firstName || conv.agent.first_name,
        last_name: conv.agent.lastName || conv.agent.last_name,
      } : null,
      deal: conv.deal ? {
        id: conv.deal.id,
        client_name: conv.deal.clientName || conv.deal.client_name,
        policy_number: conv.deal.policyNumber || conv.deal.policy_number,
      } : null,
    }));

    // Get messages if requested
    let messagesData = null;
    if (params.include_messages && conversations.length > 0) {
      const conversationIds = formattedConversations.slice(0, 10).map((c: any) => c.id);

      // Fetch messages for first few conversations
      const messagesPromises = conversationIds.map(async (convId: string) => {
        try {
          const msgResponse = await fetch(
            `${apiUrl}/api/sms/conversations/${convId}/messages?limit=20`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              cache: 'no-store',
            }
          );
          if (msgResponse.ok) {
            const msgData = await msgResponse.json();
            return (msgData.messages || []).map((m: any) => ({
              id: m.id,
              conversation_id: convId,
              direction: m.direction,
              sent_at: m.sentAt || m.sent_at || m.createdAt || m.created_at,
              body: m.body,
            }));
          }
        } catch (e) {
          console.error('Error fetching messages for conversation:', convId, e);
        }
        return [];
      });

      const allMessages = await Promise.all(messagesPromises);
      messagesData = allMessages.flat().slice(0, 100);
    }

    // Calculate summary
    const totalConversations = formattedConversations.length;
    const activeConversations = formattedConversations.filter((c: any) => c.is_active).length;
    const optedInCount = formattedConversations.filter((c: any) => c.sms_opt_in_status === 'opted_in').length;

    return Response.json({
      conversations: formattedConversations,
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
