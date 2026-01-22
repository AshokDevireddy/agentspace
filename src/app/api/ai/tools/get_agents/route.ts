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
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        total_prod,
        total_policies_sold,
        annual_goal,
        start_date,
        status,
        is_active,
        upline:users!users_upline_id_fkey(id, first_name, last_name)
      `)
      .eq('agency_id', agencyId)
      .neq('role', 'client');

    if (params.agent_id) {
      query = query.eq('id', params.agent_id);
    }

    if (params.top_performers) {
      query = query
        .order('total_prod', { ascending: false })
        .limit(params.limit || 10);
    } else {
      query = query
        .order('total_prod', { ascending: false })
        .limit(params.limit || 100);
    }

    const { data: agents, error } = await query;

    if (error) {
      console.error('Error fetching agents:', error);
      return Response.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    // Get downlines if requested
    let agentsWithDownlines = agents;
    if (params.include_downlines && params.agent_id) {
      const { data: downlines } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, total_prod, total_policies_sold')
        .eq('upline_id', params.agent_id)
        .eq('agency_id', agencyId);

      agentsWithDownlines = agents?.map(agent => ({
        ...agent,
        downlines: agent.id === params.agent_id ? downlines : []
      }));
    }

    // Calculate summary
    const totalProduction = agents?.reduce((sum, agent) => sum + (Number(agent.total_prod) || 0), 0) || 0;
    const totalPolicies = agents?.reduce((sum, agent) => sum + (Number(agent.total_policies_sold) || 0), 0) || 0;
    const avgProduction = agents && agents.length > 0 ? totalProduction / agents.length : 0;

    return Response.json({
      agents: agentsWithDownlines,
      count: agents?.length || 0,
      summary: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        average_production: avgProduction,
        active_agents: agents?.filter(a => a.is_active).length || 0
      }
    });
  } catch (error) {
    console.error('Get agents error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

