import { createServerClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/get-user-context';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get agency ID from authenticated user, not from headers
    const userContextResult = await getUserContext();
    if (!userContextResult.success) {
      return Response.json({ error: userContextResult.error }, { status: userContextResult.status });
    }
    const { agencyId } = userContextResult.context;

    const supabase = await createServerClient();
    const params = await request.json();

    let query = supabase
      .from('deals')
      .select(`
        *,
        agent:users!deals_agent_id_fkey(id, first_name, last_name, email),
        carrier:carriers(id, name, display_name),
        product:products(id, name, product_code)
      `)
      .eq('agency_id', agencyId);

    // Apply filters
    if (params.status && params.status !== 'all') {
      query = query.eq('status_standardized', params.status);
    }

    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }

    if (params.carrier_id) {
      query = query.eq('carrier_id', params.carrier_id);
    }

    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }

    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    query = query.limit(params.limit || 100);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching deals:', error);
      return Response.json({ error: 'Failed to fetch deals' }, { status: 500 });
    }

    // Calculate aggregates
    const totalPremium = data?.reduce((sum, deal) => sum + (Number(deal.annual_premium) || 0), 0) || 0;
    const avgPremium = data && data.length > 0 ? totalPremium / data.length : 0;
    const statusCounts = data?.reduce((acc: any, deal) => {
      const status = deal.status_standardized || deal.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}) || {};

    return Response.json({
      deals: data,
      count: data?.length || 0,
      summary: {
        total_annual_premium: totalPremium,
        average_premium: avgPremium,
        status_breakdown: statusCounts
      }
    });
  } catch (error) {
    console.error('Get deals error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

