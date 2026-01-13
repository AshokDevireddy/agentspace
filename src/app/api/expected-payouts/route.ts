import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/expected-payouts
 * Fetches expected payouts for deals based on commission percentages
 *
 * Query Parameters:
 * - months_past: Number of months to look back (default: 12)
 * - months_future: Number of months to look forward (default: 12)
 * - carrier_id: Optional carrier filter
 * - agent_id: Required agent ID to get payouts for (defaults to current user)
 * - production_mode: 'submitted' | 'issue_paid' (default: 'submitted')
 *   - submitted: All deals (no status filter)
 *   - issue_paid: Only active deals where effective_date + 7 days < today
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient();

  try {
    // Get the current user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, first_name, last_name')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const months_past = searchParams.get('months_past') ? parseInt(searchParams.get('months_past')!) : 12;
    const months_future = searchParams.get('months_future') ? parseInt(searchParams.get('months_future')!) : 12;
    const carrier_id = searchParams.get('carrier_id') || null;
    const agent_id = searchParams.get('agent_id') || userData.id; // Default to current user
    const production_mode = (searchParams.get('production_mode') as 'submitted' | 'issue_paid') || 'submitted';

    // Call the RPC function
    const { data: payouts, error: rpcError } = await supabase
      .rpc('get_expected_payouts', {
        p_user_id: userData.id,
        p_agent_id: agent_id,
        p_months_past: months_past,
        p_months_future: months_future,
        p_carrier_id: carrier_id
      });

    if (rpcError) {
      console.error('[Expected Payouts] RPC error:', {
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code
      });
      return NextResponse.json(
        {
          error: `Failed to fetch expected payouts: ${rpcError.message}`,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        },
        { status: 500 }
      );
    }

    // Get deal information to determine writing agent for each deal
    // Also get status and effective date for Issue Paid filtering
    const dealIds = (payouts || []).map((p: any) => p.deal_id);
    let dealInfoMap: Record<string, { agent_id: string; status_standardized: string; policy_effective_date: string }> = {};

    if (dealIds.length > 0) {
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, agent_id, status_standardized, policy_effective_date')
        .in('id', dealIds);

      if (dealsError) {
        console.error('[Expected Payouts] Failed to fetch deal info:', {
          message: dealsError.message,
          details: dealsError.details,
          dealIds: dealIds.slice(0, 10) // Log first 10 for debugging
        });
        // Continue with empty map - payouts will be filtered out but we won't crash
      } else if (deals) {
        dealInfoMap = deals.reduce((acc: Record<string, any>, deal: any) => {
          acc[deal.id] = {
            agent_id: deal.agent_id,
            status_standardized: deal.status_standardized,
            policy_effective_date: deal.policy_effective_date
          };
          return acc;
        }, {});
      }
    }

    // Calculate Issue Paid cutoff date (7 days ago)
    const today = new Date();
    const issuePaidCutoff = new Date(today);
    issuePaidCutoff.setDate(issuePaidCutoff.getDate() - 7);
    const issuePaidCutoffDate = issuePaidCutoff.toISOString().split('T')[0];

    // Filter payouts based on production mode and split into your vs downline production
    const yourProduction: any[] = [];
    const downlineProduction: any[] = [];

    (payouts || []).forEach((payout: any) => {
      const dealInfo = dealInfoMap[payout.deal_id];
      if (!dealInfo) return;

      // Apply Issue Paid filter if in issue_paid mode
      if (production_mode === 'issue_paid') {
        // Must be active status AND have valid effective date AND effective date + 7 days < today
        if (dealInfo.status_standardized !== 'active') return;
        if (!dealInfo.policy_effective_date) return; // Skip deals with no effective date
        if (dealInfo.policy_effective_date > issuePaidCutoffDate) return;
      }

      if (dealInfo.agent_id === agent_id) {
        // This is your production (you are the writing agent)
        yourProduction.push(payout);
      } else {
        // This is downline production (commission from hierarchy)
        downlineProduction.push(payout);
      }
    });

    // Calculate totals
    const calculateTotal = (arr: any[]) =>
      arr.reduce((sum, p) => sum + (parseFloat(p.expected_payout) || 0), 0);

    const yourTotal = calculateTotal(yourProduction);
    const downlineTotal = calculateTotal(downlineProduction);
    const totalPayout = yourTotal + downlineTotal;

    // Combine filtered payouts for the response
    const filteredPayouts = [...yourProduction, ...downlineProduction];

    return NextResponse.json({
      success: true,
      payouts: filteredPayouts,
      production: {
        your: {
          payouts: yourProduction,
          total: yourTotal,
          count: yourProduction.length
        },
        downline: {
          payouts: downlineProduction,
          total: downlineTotal,
          count: downlineProduction.length
        },
        total: totalPayout,
        totalCount: filteredPayouts.length
      },
      filters: {
        months_past,
        months_future,
        carrier_id,
        agent_id,
        production_mode
      },
      user: {
        id: userData.id,
        name: `${userData.first_name} ${userData.last_name}`,
        role: userData.role
      }
    });

  } catch (err: any) {
    console.error('[Expected Payouts] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch expected payouts" },
      { status: 500 }
    );
  }
}
