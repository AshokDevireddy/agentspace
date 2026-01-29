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

    if (params.status && params.status !== 'all') {
      queryParams.set('status_standardized', params.status);
    }
    if (params.agent_id) {
      queryParams.set('agent_id', params.agent_id);
    }
    if (params.carrier_id) {
      queryParams.set('carrier_id', params.carrier_id);
    }
    if (params.start_date) {
      queryParams.set('date_from', params.start_date);
    }
    if (params.end_date) {
      queryParams.set('date_to', params.end_date);
    }
    queryParams.set('limit', String(params.limit || 100));
    queryParams.set('view', 'all'); // AI tools need full agency view

    // Call Django deals endpoint
    const djangoResponse = await fetch(
      `${apiUrl}/api/deals/?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    if (!djangoResponse.ok) {
      const errorData = await djangoResponse.json().catch(() => ({}));
      console.error('Error fetching deals:', errorData);
      return Response.json({ error: 'Failed to fetch deals' }, { status: djangoResponse.status });
    }

    const djangoData = await djangoResponse.json();
    const deals = djangoData.deals || [];

    // Calculate aggregates (same logic as before)
    const totalPremium = deals.reduce((sum: number, deal: any) => sum + (Number(deal.annualPremium) || 0), 0);
    const avgPremium = deals.length > 0 ? totalPremium / deals.length : 0;
    const statusCounts = deals.reduce((acc: Record<string, number>, deal: any) => {
      const status = deal.statusStandardized || deal.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return Response.json({
      deals: deals,
      count: deals.length,
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
