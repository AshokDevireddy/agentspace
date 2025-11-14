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

    // Fetch deal with related agent, carrier, and product information
    const { data: deal, error } = await admin
      .from("deals")
      .select(`
        *,
        agent:users!deals_agent_id_fkey(id, first_name, last_name, email),
        carrier:carriers(id, name),
        product:products(id, name)
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

    // Mask phone if needed
    const dealWithMaskedPhone = {
      ...deal,
      client_phone: shouldHidePhone ? 'HIDDEN' : deal.client_phone,
      phone_hidden: shouldHidePhone,
      is_writing_agent: isWritingAgent
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

    // Add updated_at timestamp
    data.updated_at = new Date().toISOString();

    const { data: deal, error } = await supabase
      .from("deals")
      .update(data)
      .eq("id", dealId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ deal, message: "Deal updated successfully" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update deal" },
      { status: 500 }
    );
  }
}