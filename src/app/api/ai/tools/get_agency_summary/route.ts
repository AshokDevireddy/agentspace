import { createServerClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const agencyId = request.headers.get('x-agency-id');

    if (!agencyId) {
      return Response.json({ error: 'Agency ID required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const params = await request.json();

    // Get date range based on time period
    let startDate: Date | null = null;
    const now = new Date();

    switch (params.time_period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = null;
    }

    // Get agency info
    const { data: agency } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single();

    // Get agent count
    const { count: agentCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .neq('role', 'client')
      .eq('is_active', true);

    // Get deals with date filter if applicable
    let dealsQuery = supabase
      .from('deals')
      .select('annual_premium, status_standardized, created_at')
      .eq('agency_id', agencyId);

    if (startDate) {
      dealsQuery = dealsQuery.gte('created_at', startDate.toISOString());
    }

    const { data: deals } = await dealsQuery;

    // Calculate metrics
    const totalProduction = deals?.reduce((sum, deal) => sum + (Number(deal.annual_premium) || 0), 0) || 0;
    const totalPolicies = deals?.length || 0;
    const activePolicies = deals?.filter(d => d.status_standardized === 'active').length || 0;

    // Get top agents
    const { data: topAgents } = await supabase
      .from('users')
      .select('id, first_name, last_name, total_prod, total_policies_sold')
      .eq('agency_id', agencyId)
      .neq('role', 'client')
      .eq('is_active', true)
      .order('total_prod', { ascending: false })
      .limit(5);

    // Get recent activity
    const { data: recentDeals } = await supabase
      .from('deals')
      .select(`
        id,
        client_name,
        annual_premium,
        created_at,
        status_standardized,
        agent:users!deals_agent_id_fkey(first_name, last_name)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(10);

    return Response.json({
      agency: {
        name: agency?.name,
        display_name: agency?.display_name,
        code: agency?.code,
        is_active: agency?.is_active
      },
      metrics: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        active_policies: activePolicies,
        agent_count: agentCount || 0,
        time_period: params.time_period || 'all'
      },
      top_agents: topAgents,
      recent_activity: recentDeals
    });
  } catch (error) {
    console.error('Get agency summary error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

