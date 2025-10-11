import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = createServerClient();

  try {
    // Identify current user and compute visible agent IDs (self + downline)
    const {
      data: { session },
    } = await server.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Map auth user to `users` row
    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error('Error fetching current user:', currentUserError);
      return NextResponse.json({ error: 'Failed to resolve current user' }, { status: 500 });
    }

    // Fetch full downline via RPC (returns array of users)
    const { data: downline, error: downlineError } = await admin.rpc('get_agent_downline', {
      agent_id: currentUser.id,
    });

    if (downlineError) {
      console.error('Error fetching downline:', downlineError);
      return NextResponse.json({ error: 'Failed to fetch downline' }, { status: 500 });
    }

    const visibleAgentIds: string[] = [currentUser.id, ...((downline as any[])?.map((u: any) => u.id) || [])];

    // Get query parameters for filtering + pagination (keyset)
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agent_id');
    const carrierId = searchParams.get('carrier_id');
    const policyNumber = searchParams.get('policy_number');
    const status = searchParams.get('status');
    const clientName = searchParams.get('client_name');
    const leadSource = searchParams.get('lead_source');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const cursorCreatedAt = searchParams.get('cursor_created_at');
    const cursorId = searchParams.get('cursor_id');

    // Build the query with joins
    // Build filters JSON for the RPC
    const filters: any = {
      agent_id: agentId && agentId !== 'all' && visibleAgentIds.includes(agentId) ? agentId : '',
      carrier_id: carrierId && carrierId !== 'all' ? carrierId : '',
      policy_number: policyNumber || '',
      status: status && status !== 'all' ? status : '',
      client_name: clientName || '',
      lead_source: leadSource && leadSource !== 'all' ? leadSource : ''
    };

    // Call RPC to fetch visible deals with keyset pagination
    let { data: deals, error } = await admin.rpc('get_visible_deals', {
      p_agent_id: currentUser.id,
      p_limit: limit,
      p_cursor_created_at: cursorCreatedAt ? new Date(cursorCreatedAt).toISOString() : null,
      p_cursor_id: cursorId || null,
      p_filters: filters
    });

    // Fallback: if RPC not found (e.g., not deployed yet), run an equivalent query in PostgREST
    if (error && (error as any)?.code === 'PGRST202') {
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
          status,
          notes,
          agent:agent_id(id, first_name, last_name),
          carrier:carrier_id(id, display_name),
          product:product_id(id, name)
        `)
        .in('agent_id', visibleAgentIds)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (filters.agent_id) query = query.eq('agent_id', filters.agent_id);
      if (filters.carrier_id) query = query.eq('carrier_id', filters.carrier_id);
      if (filters.policy_number) query = query.ilike('policy_number', `%${filters.policy_number}%`);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.client_name) query = query.ilike('client_name', `%${filters.client_name}%`);
      if (filters.lead_source) query = query.eq('lead_source', filters.lead_source);

      if (cursorCreatedAt && cursorId) {
        const iso = new Date(cursorCreatedAt).toISOString();
        // Keyset condition: (created_at, id) < (cursorCreatedAt, cursorId)
        query = query.or(`created_at.lt.${iso},and(created_at.eq.${iso},id.lt.${cursorId})`);
      }

      const { data, error: qErr } = await query.limit(limit);
      if (qErr) {
        console.error('Error fetching deals (fallback):', qErr);
        return NextResponse.json({ error: qErr.message }, { status: 400 });
      }
      deals = data as any[];
      error = null as any;
    } else if (error) {
      console.error('Error fetching deals:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Transform the data to match the expected format
    const transformedDeals = (deals || []).map((deal: any) => ({
      id: deal.id,
      carrierId: deal.carrier_id || '',
      date: new Date(deal.created_at).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
      }),
      agent: `${deal.agent_last_name || 'Unknown'}, ${deal.agent_first_name || 'Agent'}`,
      carrier: deal.carrier_display_name || 'Unknown Carrier',
      product: deal.product_name || 'Unknown Product',
      policyNumber: deal.policy_number || '',
      appNumber: deal.application_number || '',
      clientName: deal.client_name,
      clientPhone: deal.client_phone || '',
      effectiveDate: new Date(deal.policy_effective_date).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
      }),
      annualPremium: `$${Number(deal.annual_premium || 0).toFixed(2)}`,
      leadSource: deal.lead_source === 'no_lead' ? 'No Lead' :
                 deal.lead_source === 'referral' ? 'Referral' :
                 deal.lead_source === 'provided' ? 'Provided' :
                 deal.lead_source === 'purchased' ? 'Purchased' :
                 deal.lead_source || 'No Lead',
      leadSourceType: deal.notes || '',
      status: deal.status === 'pending' ? 'Pending Approval' :
              deal.status === 'verified' ? 'Verified' :
              deal.status === 'active' ? 'Active' :
              deal.status === 'terminated' ? 'Terminated' : 'Draft'
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