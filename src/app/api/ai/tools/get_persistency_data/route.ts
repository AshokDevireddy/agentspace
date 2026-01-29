import { proxyToBackend } from '@/lib/api-proxy';
import { getUserContext } from '@/lib/auth/get-user-context';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get agency ID from authenticated user, not from headers
    const userContextResult = await getUserContext();
    if (!userContextResult.success) {
      return Response.json({ error: userContextResult.error }, { status: userContextResult.status });
    }
    const { agencyId } = userContextResult.context;

    const params = await request.json();

    // Call Django API for persistency analytics
    const response = await proxyToBackend(request, '/api/analytics/persistency', {
      method: 'GET',
      searchParams: {
        agency_id: agencyId,
        carrier: params.carrier || '',
        time_range: params.time_range || '',
      },
    });

    // Get the response data
    const data = await response.json();

    if (response.status !== 200) {
      console.error('Error fetching persistency data:', data);
      return Response.json({ error: 'Failed to fetch persistency data' }, { status: 500 });
    }

    // Filter by carrier if specified
    let filteredData = data;
    if (params.carrier && filteredData?.carriers) {
      filteredData = {
        ...data,
        carriers: data.carriers.filter((c: { carrier: string }) =>
          c.carrier.toLowerCase().includes(params.carrier.toLowerCase())
        )
      };
    }

    // Filter by time range if specified
    if (params.time_range && filteredData?.carriers) {
      filteredData.carriers = filteredData.carriers.map((carrier: { timeRanges?: Record<string, unknown> }) => ({
        ...carrier,
        selectedTimeRange: params.time_range,
        timeRangeData: carrier.timeRanges?.[params.time_range]
      }));
    }

    return Response.json({
      persistency_data: filteredData,
      carriers: filteredData?.carriers || [],
      overall_analytics: filteredData?.overallAnalytics || {},
      carrier_comparison: filteredData?.carrierComparison || {}
    });
  } catch (error) {
    console.error('Get persistency error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
