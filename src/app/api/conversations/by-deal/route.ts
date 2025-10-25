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

    // Fetch the deal to get client_phone and agency_id
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("client_phone, agency_id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      console.error('Error fetching deal:', dealError);
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // First, try to find conversation for this specific deal
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, agent_id, deal_id, last_message_at, created_at, client_phone")
      .eq("deal_id", dealId)
      .eq("type", "sms")
      .eq("is_active", true)
      .single();

    if (conversationError && conversationError.code !== 'PGRST116') {
      console.error('Error fetching conversation:', conversationError);
      return NextResponse.json({ error: conversationError.message }, { status: 400 });
    }

    // If no conversation for this deal, check if there's an existing conversation with this phone number in the agency
    let existingConversation = null;
    if (!conversation && deal.client_phone) {
      const { data: phoneConversation } = await supabase
        .from("conversations")
        .select("id, agent_id, deal_id, last_message_at, created_at, client_phone")
        .eq("agency_id", deal.agency_id)
        .eq("client_phone", deal.client_phone)
        .eq("type", "sms")
        .eq("is_active", true)
        .single();

      if (phoneConversation) {
        existingConversation = phoneConversation;
      }
    }

    if (!conversation && !existingConversation) {
      return NextResponse.json({ conversation: null, messages: [], existingConversation: null }, { status: 200 });
    }

    const activeConversation = conversation || existingConversation;

    // Fetch last 10 messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, conversation_id, body, direction, sent_at, status, metadata")
      .eq("conversation_id", activeConversation.id)
      .order("sent_at", { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: messagesError.message }, { status: 400 });
    }

    // Reverse to show oldest first
    const sortedMessages = (messages || []).reverse();

    return NextResponse.json({
      conversation: conversation || null,
      existingConversation: existingConversation || null,
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

