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
      .select("id, client_name, client_phone, client_email, agent_id, agency_id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (!deal.client_phone) {
      return NextResponse.json({ error: "No phone number on file for this client" }, { status: 400 });
    }

    // Fetch agency details for welcome message
    const agencyId = deal.agency_id || currentUser.agency_id;
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name, phone_number")
      .eq("id", agencyId)
      .single();

    if (agencyError || !agency) {
      console.error('Error fetching agency:', agencyError);
      return NextResponse.json({ error: "Failed to fetch agency details" }, { status: 400 });
    }

    if (!agency.phone_number) {
      return NextResponse.json({ error: "Agency phone number not configured" }, { status: 400 });
    }

    // Fetch agent details for welcome message
    const { data: agentData } = await admin
      .from('users')
      .select('id, first_name, last_name')
      .eq('id', deal.agent_id)
      .single();

    const agentName = agentData ? `${agentData.first_name} ${agentData.last_name}` : 'your agent';

    // Check if conversation already exists for this phone number in this agency
    // Use .limit(1) to get at most one result, avoiding the multiple rows error
    const { data: existingConversations, error: existingError } = await admin
      .from("conversations")
      .select("id, agent_id, deal_id")
      .eq("agency_id", agencyId)
      .eq("client_phone", deal.client_phone)
      .eq("type", "sms")
      .eq("is_active", true)
      .limit(1);

    if (existingError) {
      console.error('Error checking existing conversation:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (existingConversations && existingConversations.length > 0) {
      const existingConversation = existingConversations[0];
      console.log('Conversation already exists for this phone number:', deal.client_phone);

      return NextResponse.json({
        error: 'A conversation with this phone number already exists. Each client can only have one active SMS conversation per agency.',
        existingConversation: existingConversation
      }, { status: 409 }); // 409 Conflict
    }

    // Create conversation with auto opt-in
    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .insert({
        agent_id: deal.agent_id,
        deal_id: deal.id,
        agency_id: agencyId,
        client_phone: deal.client_phone,
        type: "sms",
        is_active: true,
        sms_opt_in_status: "opted_in", // Auto opt-in for informational messages
        opted_in_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      return NextResponse.json({ error: conversationError.message }, { status: 400 });
    }

    // Send welcome message
    const clientFirstName = deal.client_name?.split(' ')[0] || 'there';
    const clientEmail = deal.client_email || 'your email';
    const welcomeMessage = `Welcome ${clientFirstName}! Thank you for choosing ${agency.name} for your life insurance needs. Your agent ${agentName} is here to help. You'll receive policy updates and reminders by text. Complete your account setup by clicking the invitation sent to ${clientEmail}. Message frequency may vary. Msg&data rates may apply. Reply STOP to opt out. Reply HELP for help.`;

    try {
      const telnyxResponse = await sendSMS({
        from: agency.phone_number,
        to: deal.client_phone,
        text: welcomeMessage
      });

      // Save message to database
      await admin
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: deal.agent_id,
          receiver_id: deal.agent_id, // Placeholder
          body: welcomeMessage,
          direction: "outbound",
          sent_at: new Date().toISOString(),
          status: "sent",
          message_type: "sms",
          metadata: {
            automated: true,
            type: "welcome_message",
            telnyx_message_id: telnyxResponse.data?.id
          }
        });

      console.log(`Welcome message sent to ${deal.client_phone}`);

    } catch (smsError: any) {
      console.error('Error sending welcome SMS:', smsError);
      // Don't fail the whole request if SMS fails
      // The conversation is already created
    }

    return NextResponse.json({
      conversation,
      message: "Conversation started and welcome message sent"
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error in start conversation API:', err);
    return NextResponse.json(
      { error: err.message || "Failed to start conversation" },
      { status: 500 }
    );
  }
}

