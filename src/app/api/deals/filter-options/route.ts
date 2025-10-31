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
      .select('id, agency_id, perm_level, role')
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
    // Use the same logic as book-of-business API to determine visible deals
    const isAdmin = currentUser.perm_level === 'admin' || currentUser.role === 'admin';

    let policyNumbersQuery = admin
      .from('deals')
      .select('policy_number')
      .not('policy_number', 'is', null)
      .neq('policy_number', '');

    // Apply same visibility logic as book-of-business route
    if (isAdmin) {
      policyNumbersQuery = policyNumbersQuery.eq('agency_id', currentUser.agency_id);
    } else {
      // Non-admin sees only their downline
      policyNumbersQuery = policyNumbersQuery.in('agent_id', visibleUserIds);
    }

    const { data: policyNumbers, error: policyNumbersError } = await policyNumbersQuery;

    if (policyNumbersError) {
      console.error('Error fetching policy numbers:', policyNumbersError);
      return NextResponse.json({ error: policyNumbersError.message }, { status: 400 });
    }

    // Get unique policy numbers (deduplicate) and sort alphabetically
    const uniquePolicyNumbers = [...new Set((policyNumbers || []).map(p => p.policy_number).filter(Boolean))].sort();

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
      { value: "all", label: "All Policy Numbers" },
      ...(uniquePolicyNumbers.map(policyNumber => ({
        value: policyNumber,
        label: policyNumber
      })))
    ];

    // Fetch products - filter by agency
    const carrierIds = carriers?.map(c => c.id) || [];
    let productsQuery = admin
      .from('products')
      .select('id, name, carrier_id')
      .eq('agency_id', currentUser.agency_id)
      .eq('is_active', true);

    if (carrierIds.length > 0) {
      productsQuery = productsQuery.in('carrier_id', carrierIds);
    }

    const { data: products, error: productsError } = await productsQuery.order('name', { ascending: true });

    if (productsError) {
      console.error('Error fetching products:', productsError);
    }

    const productOptions = [
      { value: "all", label: "All Products" },
      ...(products?.map(product => ({
        value: product.id,
        label: product.name
      })) || [])
    ];

    // Fetch clients (users with role='client') for this agency
    const { data: clients, error: clientsError } = await admin
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('agency_id', currentUser.agency_id)
      .eq('role', 'client')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
    }

    const clientOptions = [
      { value: "all", label: "All Clients" },
      ...(clients?.map(client => ({
        value: client.id,
        label: `${client.first_name} ${client.last_name}${client.email ? ` - ${client.email}` : ''}`
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

    const statusOptions = [
      { value: "all", label: "All Statuses" },
      ...(visibleStatuses?.map(status => ({
        value: status,
        label: status.charAt(0).toUpperCase() + status.slice(1)
      })) || [])
    ];

    // Fetch unique billing cycles from deals
    const { data: billingCycleData, error: billingCycleError } = await admin
      .from('deals')
      .select('billing_cycle')
      .eq('agency_id', currentUser.agency_id)
      .not('billing_cycle', 'is', null);

    if (billingCycleError) {
      console.error('Error fetching billing cycles:', billingCycleError);
    }

    const uniqueBillingCycles = [...new Set((billingCycleData || [])
      .map(d => d.billing_cycle)
      .filter(cycle => cycle))]
      .sort();

    const billingCycleOptions = [
      { value: "all", label: "All Billing Cycles" },
      ...(uniqueBillingCycles?.map(cycle => ({
        value: cycle,
        label: cycle.charAt(0).toUpperCase() + cycle.slice(1)
      })) || [])
    ];

    // Fetch unique lead sources from deals
    const { data: leadSourceData, error: leadSourceDataError } = await admin
      .from('deals')
      .select('lead_source')
      .eq('agency_id', currentUser.agency_id)
      .not('lead_source', 'is', null);

    if (leadSourceDataError) {
      console.error('Error fetching lead sources:', leadSourceDataError);
    }

    const uniqueLeadSources = [...new Set((leadSourceData || [])
      .map(d => d.lead_source)
      .filter(source => source))]
      .sort();

    const leadSourceOptions = [
      { value: "all", label: "All Lead Sources" },
      ...(uniqueLeadSources?.map(source => ({
        value: source,
        label: source.charAt(0).toUpperCase() + source.slice(1)
      })) || [])
    ];

    const hasAlertOptions = [
      { value: "all", label: "All" },
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" }
    ];

    return NextResponse.json({
      agents: agentOptions,
      carriers: carrierOptions,
      products: productOptions,
      clients: clientOptions,
      policyNumbers: policyNumberOptions,
      statuses: statusOptions,
      billingCycles: billingCycleOptions,
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