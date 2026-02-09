import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { sendWelcomeMessage } from "@/lib/sms-helpers";

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    const { dealId } = await req.json();

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Get current user
    const { data: { user } } = await server.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, agency_id, first_name, last_name')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'Failed to resolve current user' }, { status: 500 });
    }

    // Fetch deal details
    const { data: deal, error: dealError } = await admin
      .from("deals")
      .select("id, client_name, client_phone, client_email, agent_id, agency_id, face_value, monthly_premium, policy_effective_date, policy_number, carrier_id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (!deal.client_phone) {
      return NextResponse.json({ error: "No phone number on file for this client" }, { status: 400 });
    }

    // Fetch agency details for pre-validation
    const agencyId = deal.agency_id || currentUser.agency_id;
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("phone_number, messaging_enabled")
      .eq("id", agencyId)
      .single();

    if (agencyError || !agency) {
      console.error('Error fetching agency:', agencyError);
      return NextResponse.json({ error: "Failed to fetch agency details" }, { status: 400 });
    }

    if (!agency.phone_number) {
      return NextResponse.json({ error: "Agency phone number not configured" }, { status: 400 });
    }

    // Check master switch first
    if (!agency.messaging_enabled) {
      return NextResponse.json({ error: "Messaging is disabled for this agency" }, { status: 400 });
    }

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

    try {
      await sendWelcomeMessage(
        deal.client_phone,
        agencyId,
        deal.agent_id,
        conversation.id,
        deal.client_name,
        deal.client_email,
      );
    } catch (smsError) {
      console.error('Error creating welcome SMS:', smsError);
    }

    return NextResponse.json({
      conversation,
      message: "Conversation started and welcome message sent"
    }, { status: 200 });

  } catch (err) {
    console.error('Error in start conversation API:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start conversation" },
      { status: 500 }
    );
  }
}

