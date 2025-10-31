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
    const isAdmin = currentUser.perm_level === 'admin' || currentUser.role === 'admin';

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

    // Build query for deals
    let query = admin
      .from('deals')
      .select(`
        id,
        created_at,
        policy_number,
        application_number,
        client_name,
        client_phone,
        policy_effective_date,
        annual_premium,
        lead_source,
        billing_cycle,
        status,
        notes,
        agent:agent_id(id, first_name, last_name),
        carrier:carrier_id(id, display_name),
        product:product_id(id, name)
      `)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    // Filter by agency for admins, or by agent downline for non-admins
    if (isAdmin) {
      query = query.eq('agency_id', currentUser.agency_id);
    } else {
      // Non-admin sees only their downline
      const { data: downline, error: downlineError } = await admin.rpc('get_agent_downline', {
        agent_id: currentUser.id,
      });

      if (downlineError) {
        console.error('Error fetching downline:', downlineError);
        return NextResponse.json({ error: 'Failed to fetch downline' }, { status: 500 });
      }

      const visibleAgentIds = [currentUser.id, ...((downline as any[])?.map((u: any) => u.id) || [])];
      query = query.in('agent_id', visibleAgentIds);
    }

    // Apply filters
    if (agentId && agentId !== 'all') query = query.eq('agent_id', agentId);
    if (carrierId && carrierId !== 'all') query = query.eq('carrier_id', carrierId);
    if (productId && productId !== 'all') query = query.eq('product_id', productId);
    if (clientId && clientId !== 'all') query = query.eq('client_id', clientId);
    if (policyNumber && policyNumber !== 'all' && policyNumber.trim()) query = query.eq('policy_number', policyNumber.trim());
    if (status && status !== 'all') query = query.eq('status', status);
    if (billingCycle && billingCycle !== 'all') query = query.eq('billing_cycle', billingCycle);
    if (leadSource && leadSource !== 'all') query = query.eq('lead_source', leadSource);
    if (effectiveDateStart) query = query.gte('policy_effective_date', effectiveDateStart);
    if (effectiveDateEnd) query = query.lte('policy_effective_date', effectiveDateEnd);

    // Apply cursor pagination
    if (cursorCreatedAt && cursorId) {
      const iso = new Date(cursorCreatedAt).toISOString();
      query = query.or(`created_at.lt.${iso},and(created_at.eq.${iso},id.lt.${cursorId})`);
    }

    const { data: deals, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching deals:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Transform the data to match the expected format
    const transformedDeals = (deals || []).map((deal: any) => ({
      id: deal.id,
      carrierId: deal.carrier?.id || '',
      date: new Date(deal.created_at).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
      }),
      agent: `${deal.agent?.last_name || 'Unknown'}, ${deal.agent?.first_name || 'Agent'}`,
      carrier: deal.carrier?.display_name || 'Unknown Carrier',
      product: deal.product?.name || 'Unknown Product',
      policyNumber: deal.policy_number || '',
      appNumber: deal.application_number || '',
      clientName: deal.client_name,
      clientPhone: deal.client_phone || '',
      effectiveDate: deal.policy_effective_date ? new Date(deal.policy_effective_date).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
      }) : 'N/A',
      annualPremium: `$${Number(deal.annual_premium || 0).toFixed(2)}`,
      billingCycle: deal.billing_cycle || '',
      leadSource: deal.lead_source || '',
      status: deal.status || 'draft'
    }));

    // Provide next cursor for keyset pagination
    const last = (deals || [])[deals.length - 1];
    const nextCursor = last ? { cursor_created_at: last.created_at, cursor_id: last.id } : null;

    return NextResponse.json({ deals: transformedDeals, nextCursor }, { status: 200 });
  } catch (err: any) {
    console.error('Error in book-of-business API:', err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch deals" },
      { status: 500 }
    );
  }
}