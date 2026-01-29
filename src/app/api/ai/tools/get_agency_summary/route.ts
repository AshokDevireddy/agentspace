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

    // Get date range based on time period
    let startDate: string | null = null;
    let endDate: string | null = null;
    const now = new Date();

    switch (params.time_period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case 'last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth.toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      default:
        startDate = null;
        endDate = null;
    }

    // Fetch dashboard summary from Django
    const summaryResponse = await fetch(
      `${apiUrl}/api/dashboard/summary`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    let dashboardData: any = {};
    if (summaryResponse.ok) {
      dashboardData = await summaryResponse.json();
    }

    // Fetch user profile to get agency info
    const profileResponse = await fetch(
      `${apiUrl}/api/user/profile`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    let agencyName = '';
    let agencyId = '';
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      agencyName = profileData.agencyName || '';
      agencyId = profileData.agencyId || '';
    }

    // Fetch top agents
    const agentsResponse = await fetch(
      `${apiUrl}/api/agents/?view=table&limit=5`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    let topAgents: any[] = [];
    if (agentsResponse.ok) {
      const agentsData = await agentsResponse.json();
      topAgents = (agentsData.agents || [])
        .sort((a: any, b: any) => (b.totalProd || 0) - (a.totalProd || 0))
        .slice(0, 5)
        .map((agent: any) => ({
          id: agent.agentId || agent.id,
          first_name: agent.firstName || agent.first_name,
          last_name: agent.lastName || agent.last_name,
          total_prod: agent.totalProd || agent.total_prod || 0,
          total_policies_sold: agent.totalPoliciesSold || agent.total_policies_sold || 0,
        }));
    }

    // Fetch recent deals
    const dealsParams = new URLSearchParams();
    dealsParams.set('limit', '10');
    dealsParams.set('view', 'all');

    const dealsResponse = await fetch(
      `${apiUrl}/api/deals/?${dealsParams.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    let recentDeals: any[] = [];
    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json();
      recentDeals = (dealsData.deals || []).slice(0, 10).map((deal: any) => ({
        id: deal.id,
        client_name: deal.clientName || deal.client_name,
        annual_premium: deal.annualPremium || deal.annual_premium || 0,
        created_at: deal.createdAt || deal.created_at,
        status_standardized: deal.statusStandardized || deal.status_standardized,
        agent: deal.agent ? {
          first_name: deal.agent.firstName || deal.agent.first_name,
          last_name: deal.agent.lastName || deal.agent.last_name,
        } : null,
      }));
    }

    // Calculate metrics from dashboard data or deals
    const totalProduction = dashboardData.totalProduction ||
      recentDeals.reduce((sum: number, d: any) => sum + (Number(d.annual_premium) || 0), 0);
    const totalPolicies = dashboardData.totalPolicies || recentDeals.length;
    const activePolicies = dashboardData.activePolicies ||
      recentDeals.filter((d: any) => d.status_standardized === 'active').length;
    const agentCount = dashboardData.agentCount || topAgents.length;

    return Response.json({
      agency: {
        name: agencyName,
        display_name: agencyName,
        code: agencyId,
        is_active: true
      },
      metrics: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        active_policies: activePolicies,
        agent_count: agentCount,
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
