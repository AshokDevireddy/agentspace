import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get('dealId');

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Fetch conversation for this deal
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, agent_id, deal_id, client_phone, last_message_at, created_at")
      .eq("deal_id", dealId)
      .eq("type", "sms")
      .eq("is_active", true)
      .single();

    if (conversationError && conversationError.code !== 'PGRST116') {
      console.error('Error fetching conversation:', conversationError);
      return NextResponse.json({ error: conversationError.message }, { status: 400 });
    }

    if (!conversation) {
      return NextResponse.json({ conversation: null, messages: [] }, { status: 200 });
    }

    // Fetch last 5 messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, conversation_id, body, direction, sent_at, status, metadata")
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: false })
      .limit(5);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: messagesError.message }, { status: 400 });
    }

    // Reverse to show oldest first
    const sortedMessages = (messages || []).reverse();

    return NextResponse.json({
      conversation,
      messages: sortedMessages
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error in by-deal conversation API:', err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

