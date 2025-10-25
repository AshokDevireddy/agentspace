import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/telnyx";

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    const { dealId } = await req.json();

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Get current user
    const { data: { session } } = await server.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, agency_id, first_name, last_name')
      .eq('auth_user_id', session.user.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'Failed to resolve current user' }, { status: 500 });
    }

    // Fetch deal details
    const { data: deal, error: dealError } = await admin
      .from("deals")
      .select("id, client_name, client_phone, agent_id, agency_id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (!deal.client_phone) {
      return NextResponse.json({ error: "No phone number on file for this client" }, { status: 400 });
    }

    // Check if conversation already exists for this phone number with this agent
    const { data: existingConversation, error: existingError } = await admin
      .from("conversations")
      .select("id")
      .eq("agent_id", deal.agent_id)
      .eq("client_phone", deal.client_phone)
      .eq("type", "sms")
      .eq("is_active", true)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing conversation:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (existingConversation) {
      return NextResponse.json({
        conversation: existingConversation,
        message: "Conversation already exists for this client"
      }, { status: 200 });
    }

    // Fetch agency name for opt-in message
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name")
      .eq("id", deal.agency_id || currentUser.agency_id)
      .single();

    if (agencyError) {
      console.error('Error fetching agency:', agencyError);
      return NextResponse.json({ error: "Failed to fetch agency details" }, { status: 400 });
    }

    // Create conversation
    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .insert({
        agent_id: deal.agent_id,
        deal_id: deal.id,
        agency_id: deal.agency_id || currentUser.agency_id,
        client_phone: deal.client_phone,
        type: "sms",
        is_active: true,
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      return NextResponse.json({ error: conversationError.message }, { status: 400 });
    }

    // Send opt-in message
    const optInMessage = `Thanks for your policy with ${agency.name}. You can get billing reminders and policy updates by text. Reply START to receive updates. Message frequency may vary. Msg&data rates may apply. Reply STOP to opt out. Reply HELP for help.`;

    try {
      const telnyxResponse = await sendSMS({
        to: deal.client_phone,
        message: optInMessage
      });

      // Save message to database
      await admin
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: deal.agent_id,
          receiver_id: null,
          body: optInMessage,
          direction: "outbound",
          sent_at: new Date().toISOString(),
          status: "sent",
          metadata: {
            automated: true,
            type: "opt_in",
            telnyx_message_id: telnyxResponse.id
          }
        });

    } catch (smsError: any) {
      console.error('Error sending opt-in SMS:', smsError);
      // Don't fail the whole request if SMS fails
      // The conversation is already created
    }

    return NextResponse.json({
      conversation,
      message: "Conversation started and opt-in message sent"
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error in start conversation API:', err);
    return NextResponse.json(
      { error: err.message || "Failed to start conversation" },
      { status: 500 }
    );
  }
}

