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

    // Call the persistency RPC function
    const { data, error } = await supabase.rpc('get_persistency_analytics', {
      p_agency_id: agencyId
    });

    if (error) {
      console.error('Error fetching persistency data:', error);
      return Response.json({ error: 'Failed to fetch persistency data' }, { status: 500 });
    }

    // Filter by carrier if specified
    let filteredData = data;
    if (params.carrier) {
      filteredData = {
        ...data,
        carriers: data?.carriers?.filter((c: any) =>
          c.carrier.toLowerCase().includes(params.carrier.toLowerCase())
        )
      };
    }

    // Filter by time range if specified
    if (params.time_range && filteredData?.carriers) {
      filteredData.carriers = filteredData.carriers.map((carrier: any) => ({
        ...carrier,
        selectedTimeRange: params.time_range,
        timeRangeData: carrier.timeRanges?.[params.time_range]
      }));
    }

    return Response.json({
      persistency_data: filteredData,
      carriers: filteredData?.carriers || [],
      overall_analytics: filteredData?.overall_analytics || {},
      carrier_comparison: filteredData?.carrier_comparison || {}
    });
  } catch (error) {
    console.error('Get persistency error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

