import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { sendSMS, formatPhoneForDisplay } from "@/lib/telnyx";

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

    // Fetch agency details for welcome message
    const agencyId = deal.agency_id || currentUser.agency_id;
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name, phone_number, messaging_enabled, sms_welcome_enabled, sms_welcome_template")
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

    // Fetch agent details for welcome message
    const { data: agentData } = await admin
      .from('users')
      .select('id, first_name, last_name, phone_number')
      .eq('id', deal.agent_id)
      .single();

    const agentName = agentData ? [agentData.first_name, agentData.last_name].filter(Boolean).join(' ') : 'your agent';

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

    // Create welcome message draft using agency template
    const clientFirstName = deal.client_name?.split(' ')[0] || 'there';
    const clientEmail = deal.client_email || 'your email';

    // Fetch carrier name if carrier_id exists
    let carrierName = '';
    if (deal.carrier_id) {
      const { data: carrier } = await admin
        .from('carriers')
        .select('name')
        .eq('id', deal.carrier_id)
        .single();
      carrierName = carrier?.name || '';
    }

    // Fetch beneficiaries
    const { data: beneficiaries } = await admin
      .from('beneficiaries')
      .select('first_name, last_name')
      .eq('deal_id', deal.id);

    // Choose template based on sms_welcome_enabled
    // If enabled: use custom template or default
    // If disabled: use default template
    const { replaceSmsPlaceholders, DEFAULT_SMS_TEMPLATES, formatBeneficiaries } = await import('@/lib/sms-template-helpers');
    const template = agency.sms_welcome_enabled
      ? (agency.sms_welcome_template || DEFAULT_SMS_TEMPLATES.welcome)
      : DEFAULT_SMS_TEMPLATES.welcome;

    const welcomeMessage = replaceSmsPlaceholders(template, {
      client_first_name: clientFirstName,
      agency_name: agency.name,
      agent_name: agentName,
      agent_phone: formatPhoneForDisplay(agentData?.phone_number),
      client_email: clientEmail,
      insured: deal.client_name || '',
      policy_number: deal.policy_number || '',
      face_amount: deal.face_value ? `$${deal.face_value.toLocaleString()}` : '',
      monthly_premium: deal.monthly_premium ? `$${deal.monthly_premium.toFixed(2)}` : '',
      initial_draft: deal.policy_effective_date || '',
      carrier_name: carrierName,
      beneficiaries: formatBeneficiaries(beneficiaries),
    });

    try {
      // Create message as DRAFT (not sent automatically)
      await admin
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: deal.agent_id,
          receiver_id: deal.agent_id, // Placeholder
          body: welcomeMessage,
          direction: "outbound",
          sent_at: null, // Draft messages don't have sent_at
          status: "draft", // Create as draft instead of sending
          message_type: "sms",
          metadata: {
            automated: true,
            type: "welcome_message"
          }
        });

      console.log(`Welcome message draft created for ${deal.client_phone}`);

    } catch (smsError) {
      console.error('Error sending welcome SMS:', smsError);
      // Don't fail the whole request if SMS fails
      // The conversation is already created
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

