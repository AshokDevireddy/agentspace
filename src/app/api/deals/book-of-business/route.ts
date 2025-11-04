import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    // Identify current user and compute visible agent IDs (self + downline)
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Map auth user to `users` row
    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, agency_id, perm_level, role')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error('Error fetching current user:', currentUserError);
      return NextResponse.json({ error: 'Failed to resolve current user' }, { status: 500 });
    }

    // Check if user is admin
    // Get query parameters for filtering + pagination (keyset)
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agent_id');
    const carrierId = searchParams.get('carrier_id');
    const productId = searchParams.get('product_id');
    const clientId = searchParams.get('client_id');
    const policyNumber = searchParams.get('policy_number');
    const status = searchParams.get('status');
    const billingCycle = searchParams.get('billing_cycle');
    const leadSource = searchParams.get('lead_source');
    const effectiveDateStart = searchParams.get('effective_date_start');
    const effectiveDateEnd = searchParams.get('effective_date_end');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const cursorCreatedAt = searchParams.get('cursor_created_at');
    const cursorId = searchParams.get('cursor_id');

    const filters = {
      agent_id: agentId && agentId !== 'all' ? agentId : null,
      carrier_id: carrierId && carrierId !== 'all' ? carrierId : null,
      product_id: productId && productId !== 'all' ? productId : null,
      client_id: clientId && clientId !== 'all' ? clientId : null,
      policy_number: policyNumber && policyNumber !== 'all' ? policyNumber.trim() : null,
      status: status && status !== 'all' ? status : null,
      billing_cycle: billingCycle && billingCycle !== 'all' ? billingCycle : null,
      lead_source: leadSource && leadSource !== 'all' ? leadSource : null,
      effective_date_start: effectiveDateStart || null,
      effective_date_end: effectiveDateEnd || null
    }

    const { data: deals, error: rpcError } = await admin.rpc('get_book_of_business', {
      p_user_id: currentUser.id,
      p_filters: filters,
      p_limit: limit,
      p_cursor_id: cursorId,
      p_cursor_created_at: cursorCreatedAt
    })

    if (rpcError) {
      console.error('get_book_of_business RPC error:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const transformedDeals = (deals || []).map((deal: any) => ({
      id: deal.id,
      carrierId: deal.carrier_id || '',
      date: deal.created_at
        ? new Date(deal.created_at).toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: '2-digit'
          })
        : 'N/A',
      agent: deal.agent_last_name
        ? `${deal.agent_last_name}, ${deal.agent_first_name || 'Agent'}`
        : 'Unknown, Agent',
      carrier: deal.carrier_display_name || 'Unknown Carrier',
      product: deal.product_name || 'Unknown Product',
      policyNumber: deal.policy_number || '',
      appNumber: deal.application_number || '',
      clientName: deal.client_name,
      clientPhone: deal.client_phone || '',
      effectiveDate: deal.policy_effective_date
        ? new Date(deal.policy_effective_date).toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: '2-digit'
          })
        : 'N/A',
      annualPremium: `$${Number(deal.annual_premium || 0).toFixed(2)}`,
      billingCycle: deal.billing_cycle || '',
      leadSource: deal.lead_source || '',
      status: deal.status || 'draft'
    }))

    const last = (deals || [])[deals.length - 1]
    const nextCursor = last
      ? { cursor_created_at: last.created_at, cursor_id: last.id }
      : null

    return NextResponse.json({ deals: transformedDeals, nextCursor }, { status: 200 });
  } catch (err: any) {
    console.error('Error in book-of-business API:', err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch deals" },
      { status: 500 }
    );
  }
}