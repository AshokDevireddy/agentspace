import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    const { id: dealId } = await params;

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Get current user
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Map auth user to `users` row
    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, agency_id, perm_level, role, is_admin')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error('Error fetching current user:', currentUserError);
      return NextResponse.json({ error: 'Failed to resolve current user' }, { status: 500 });
    }

    // Get view mode from query parameter
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'downlines';

    // Fetch deal with related agent, carrier, product, and client information
    const { data: deal, error } = await admin
      .from("deals")
      .select(`
        *,
        agent:users!deals_agent_id_fkey(id, first_name, last_name, email),
        carrier:carriers(id, name),
        product:products(id, name),
        client:users!deals_client_id_fkey(id, email, status)
      `)
      .eq("id", dealId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Fetch status_mapping separately
    const { data: statusMapping } = await admin
      .from("status_mapping")
      .select("impact")
      .eq("carrier_id", deal.carrier_id)
      .eq("raw_status", deal.status)
      .maybeSingle();

    // Determine if phone should be hidden
    const isAdmin = currentUser.perm_level === 'admin' || currentUser.role === 'admin' || currentUser.is_admin;
    const isWritingAgent = deal.agent_id === currentUser.id;
    const statusImpact = statusMapping?.impact;
    const isActiveOrPending = statusImpact === 'positive' || statusImpact === 'neutral';
    const shouldHidePhone = view === 'downlines' && !isAdmin && !isWritingAgent && isActiveOrPending;

    // Mask phone if needed and add client email and status from client record
    const dealWithMaskedPhone = {
      ...deal,
      client_phone: shouldHidePhone ? 'HIDDEN' : deal.client_phone,
      phone_hidden: shouldHidePhone,
      is_writing_agent: isWritingAgent,
      client_email: deal.client?.email || null,
      client_status: deal.client?.status || null
    };

    return NextResponse.json({ deal: dealWithMaskedPhone }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch deal" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient();
  try {
    const data = await req.json();
    const { id: dealId } = await params;

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Extract client_email if provided (it's not a deal field, it's a users field)
    const { client_email, ...dealData } = data;

    // If client_phone is being updated, check if it already exists for another deal in the same agency
    if (dealData.client_phone !== undefined) {
      // First get the current deal to access agency_id
      const { data: currentDeal, error: fetchError } = await supabase
        .from("deals")
        .select("agency_id")
        .eq("id", dealId)
        .single();

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 400 });
      }

      if (currentDeal?.agency_id && dealData.client_phone) {
        const { normalizePhoneForStorage } = await import('@/lib/telnyx');
        const normalizedPhone = normalizePhoneForStorage(dealData.client_phone);

        // Check if another deal in the same agency already has this phone number
        const { data: existingDeal, error: phoneCheckError } = await supabase
          .from('deals')
          .select('id, client_name, policy_number')
          .eq('client_phone', normalizedPhone)
          .eq('agency_id', currentDeal.agency_id)
          .neq('id', dealId) // Exclude the current deal
          .maybeSingle();

        if (phoneCheckError && phoneCheckError.code !== 'PGRST116') {
          console.error('[Deal Update] Error checking phone uniqueness:', phoneCheckError);
          return NextResponse.json(
            { error: `Failed to validate phone number: ${phoneCheckError.message}` },
            { status: 400 }
          );
        }

        if (existingDeal) {
          return NextResponse.json(
            {
              error: `Phone number ${dealData.client_phone} already exists for another deal in your agency (${existingDeal.client_name}, Policy: ${existingDeal.policy_number || 'N/A'}). Each deal must have a unique phone number within the agency.`,
              existing_deal_id: existingDeal.id,
            },
            { status: 409 } // 409 Conflict
          );
        }
      }
    }

    // Add updated_at timestamp
    dealData.updated_at = new Date().toISOString();

    // Update the deal
    const { data: deal, error } = await supabase
      .from("deals")
      .update(dealData)
      .eq("id", dealId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // If client_email was provided and deal has a client_id, update the client's email
    if (client_email !== undefined && deal.client_id) {
      const { error: clientError } = await supabase
        .from("users")
        .update({ email: client_email })
        .eq("id", deal.client_id);

      if (clientError) {
        console.error('Error updating client email:', clientError);
        // Don't fail the whole request if client email update fails
      }
    }

    // If client_phone was updated, also update the conversation's client_phone field
    // This ensures the conversation stays associated with the deal even when phone changes
    if (dealData.client_phone !== undefined && deal.id) {
      // Import normalizePhoneForStorage at the top if needed
      const { normalizePhoneForStorage } = await import('@/lib/telnyx');
      const normalizedPhone = dealData.client_phone ? normalizePhoneForStorage(dealData.client_phone) : null;

      const { error: convError } = await supabase
        .from("conversations")
        .update({ client_phone: normalizedPhone })
        .eq("deal_id", deal.id)
        .eq("is_active", true);

      if (convError) {
        console.error('Error updating conversation phone number:', convError);
        // Don't fail the whole request if conversation update fails
      } else {
        console.log(`📞 Updated conversation phone number for deal ${deal.id} to ${normalizedPhone}`);
      }
    }

    return NextResponse.json({ deal, message: "Deal updated successfully" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update deal" },
      { status: 500 }
    );
  }
}