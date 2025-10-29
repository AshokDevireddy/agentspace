import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    // Identify current user
    const { data: { user } } = await server.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error('Error fetching current user:', currentUserError);
      return NextResponse.json({ error: 'Failed to resolve current user' }, { status: 500 });
    }

    // Downline for agent options
    const { data: downline, error: downlineError } = await admin.rpc('get_agent_downline', {
      agent_id: currentUser.id,
    });

    if (downlineError) {
      console.error('Error fetching downline:', downlineError);
      return NextResponse.json({ error: 'Failed to fetch downline' }, { status: 500 });
    }

    const visibleUsers: any[] = [currentUser, ...((downline as any[]) || [])];
    const visibleUserIds = visibleUsers.map(u => u.id);

    // Build agent options directly from visibleUsers to avoid very large IN() URLs
    const agents = visibleUsers
      .map(u => ({ id: u.id, first_name: u.first_name, last_name: u.last_name }))
      .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));

    // Fetch carriers
    const { data: carriers, error: carriersError } = await admin
      .from('carriers')
      .select('id, display_name')
      .order('display_name', { ascending: true });

    if (carriersError) {
      console.error('Error fetching carriers:', carriersError);
      return NextResponse.json({ error: carriersError.message }, { status: 400 });
    }

    // Fetch unique policy numbers for search
    const { data: policyNumbers, error: policyNumbersError } = await admin
      .from('deals')
      .select('policy_number, agent_id')
      .not('policy_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    const visiblePolicyNumbers = (policyNumbers || []).filter(p => visibleUserIds.includes(p.agent_id as any));

    if (policyNumbersError) {
      console.error('Error fetching policy numbers:', policyNumbersError);
      return NextResponse.json({ error: policyNumbersError.message }, { status: 400 });
    }

    // Transform data for frontend consumption
    const agentOptions = [
      { value: "all", label: "Select an Agent" },
      ...(agents?.map(agent => ({
        value: agent.id,
        label: `${agent.last_name}, ${agent.first_name}`
      })) || [])
    ];

    const carrierOptions = [
      { value: "all", label: "Select a Carrier" },
      ...(carriers?.map(carrier => ({
        value: carrier.id,
        label: carrier.display_name
      })) || [])
    ];

    const policyNumberOptions = [
      ...(visiblePolicyNumbers?.map(policy => ({
        value: policy.policy_number,
        label: policy.policy_number
      })) || [])
    ];

    // Fetch unique status values from deals for this agency
    const { data: statusData, error: statusError } = await admin
      .from('deals')
      .select('status')
      .eq('agency_id', currentUser.agency_id)
      .not('status', 'is', null);

    if (statusError) {
      console.error('Error fetching statuses:', statusError);
    }

    // Get unique statuses
    const visibleStatuses = [...new Set((statusData || [])
      .map(d => d.status)
      .filter(status => status))]
      .sort();

    console.log('Found statuses for agency:', visibleStatuses);

    const statusOptions = [
      { value: "all", label: "Select a Status" },
      ...(visibleStatuses?.map(status => ({
        value: status,
        label: status.charAt(0).toUpperCase() + status.slice(1)
      })) || [])
    ];

    const leadSourceOptions = [
      { value: "all", label: "--------" },
      { value: "referral", label: "Referral" },
      { value: "purchased", label: "Purchased Lead" },
      { value: "provided", label: "Provided Lead" },
      { value: "no_lead", label: "No Lead" }
    ];

    const hasAlertOptions = [
      { value: "all", label: "All" },
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" }
    ];

    return NextResponse.json({
      agents: agentOptions,
      carriers: carrierOptions,
      policyNumbers: policyNumberOptions,
      statuses: statusOptions,
      leadSources: leadSourceOptions,
      hasAlertOptions: hasAlertOptions
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error in filter-options API:', err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch filter options" },
      { status: 500 }
    );
  }
}