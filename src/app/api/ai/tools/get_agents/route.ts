import { getSession } from '@/lib/session';
import { getApiBaseUrl } from '@/lib/api-config';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = session.accessToken;
    const apiUrl = getApiBaseUrl();
    const params = await request.json();

    // Build query params for Django endpoint
    const queryParams = new URLSearchParams();
    queryParams.set('view', 'table');
    queryParams.set('limit', String(params.limit || 100));

    // Call Django agents endpoint
    const djangoResponse = await fetch(
      `${apiUrl}/api/agents/?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    if (!djangoResponse.ok) {
      const errorData = await djangoResponse.json().catch(() => ({}));
      console.error('Error fetching agents:', errorData);
      return Response.json({ error: 'Failed to fetch agents' }, { status: djangoResponse.status });
    }

    const djangoData = await djangoResponse.json();

    // Transform Django response to match expected format
    let agents = (djangoData.agents || []).map((agent: any) => ({
      id: agent.agentId || agent.id,
      first_name: agent.firstName || agent.first_name,
      last_name: agent.lastName || agent.last_name,
      email: agent.email,
      role: agent.role,
      total_prod: agent.totalProd || agent.total_prod || 0,
      total_policies_sold: agent.totalPoliciesSold || agent.total_policies_sold || 0,
      annual_goal: agent.annualGoal || agent.annual_goal || 0,
      start_date: agent.startDate || agent.start_date,
      status: agent.status,
      is_active: agent.status === 'active',
      upline: agent.upline || null,
    }));

    // Filter by agent_id if specified
    if (params.agent_id) {
      agents = agents.filter((a: any) => a.id === params.agent_id);
    }

    // Sort by total_prod and limit for top_performers
    if (params.top_performers) {
      agents = agents
        .sort((a: any, b: any) => (b.total_prod || 0) - (a.total_prod || 0))
        .slice(0, params.limit || 10);
    }

    // Get downlines if requested
    let agentsWithDownlines = agents;
    if (params.include_downlines && params.agent_id) {
      try {
        const downlineResponse = await fetch(
          `${apiUrl}/api/agents/${params.agent_id}/downline`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: 'no-store',
          }
        );

        if (downlineResponse.ok) {
          const downlineData = await downlineResponse.json();
          const downlines = (downlineData.downlines || []).map((d: any) => ({
            id: d.id,
            first_name: d.firstName || d.first_name || d.name?.split(' ')[0],
            last_name: d.lastName || d.last_name || d.name?.split(' ').slice(1).join(' '),
            email: d.email,
            total_prod: d.totalProd || d.total_prod || 0,
            total_policies_sold: d.totalPoliciesSold || d.total_policies_sold || 0,
          }));

          agentsWithDownlines = agents.map((agent: any) => ({
            ...agent,
            downlines: agent.id === params.agent_id ? downlines : []
          }));
        }
      } catch (e) {
        console.error('Error fetching downlines:', e);
      }
    }

    // Calculate summary
    const totalProduction = agents.reduce((sum: number, agent: any) => sum + (Number(agent.total_prod) || 0), 0);
    const totalPolicies = agents.reduce((sum: number, agent: any) => sum + (Number(agent.total_policies_sold) || 0), 0);
    const avgProduction = agents.length > 0 ? totalProduction / agents.length : 0;

    return Response.json({
      agents: agentsWithDownlines,
      count: agents.length,
      summary: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        average_production: avgProduction,
        active_agents: agents.filter((a: any) => a.is_active).length
      }
    });
  } catch (error) {
    console.error('Get agents error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
