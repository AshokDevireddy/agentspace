import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/expected-payouts
 * Fetches expected payouts for deals based on commission percentages
 *
 * Query Parameters:
 * - start_date: Start date in YYYY-MM-DD format (first day of start month)
 * - end_date: End date in YYYY-MM-DD format (last day of end month)
 * - carrier_id: Optional carrier filter
 * - agent_id: Required agent ID to get payouts for (defaults to current user)
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
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const carrier_id = searchParams.get('carrier_id') || null;
    const agent_id = searchParams.get('agent_id') || userData.id; // Default to current user

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: "start_date and end_date are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Call the V3 RPC function (uses explicit date range + LEFT JOIN on status_mapping)
    const { data: payouts, error: rpcError } = await supabase
      .rpc('get_expected_payouts_v3', {
        p_user_id: userData.id,
        p_agent_id: agent_id,
        p_start_date: start_date,
        p_end_date: end_date,
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

    // Diagnostic: log a sample payout to verify the spread formula is active
    if (payouts && payouts.length > 0) {
      console.log('[Expected Payouts] Sample payout:', {
        deal_id: payouts[0].deal_id,
        agent_commission_pct: payouts[0].agent_commission_percentage,
        hierarchy_total_pct: payouts[0].hierarchy_total_percentage,
        expected_payout: payouts[0].expected_payout,
        annual_premium: payouts[0].annual_premium,
      });
    }

    // Get deal information to determine writing agent for each deal
    const dealIds = (payouts || []).map((p: any) => p.deal_id);
    let dealAgentMap: Record<string, string> = {};

    if (dealIds.length > 0) {
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, agent_id')
        .in('id', dealIds);

      if (dealsError) {
        console.error('[Expected Payouts] Failed to fetch deal agents:', dealsError);
      }

      if (!dealsError && deals) {
        dealAgentMap = deals.reduce((acc: Record<string, string>, deal: any) => {
          acc[deal.id] = deal.agent_id;
          return acc;
        }, {});
      }
    }

    // Split payouts into your production vs downline production
    const yourProduction: any[] = [];
    const downlineProduction: any[] = [];

    (payouts || []).forEach((payout: any) => {
      const writingAgentId = dealAgentMap[payout.deal_id];

      if (writingAgentId === agent_id) {
        // This is your production (you are the writing agent)
        yourProduction.push(payout);
      } else {
        // This is downline production (commission from hierarchy)
        downlineProduction.push(payout);
      }
    });

    // Calculate payout totals (commission-based expected_payout)
    const calculatePayoutTotal = (arr: any[]) =>
      arr.reduce((sum, p) => sum + (parseFloat(p.expected_payout) || 0), 0);

    // Calculate production totals (annual_premium volume)
    const calculateProductionTotal = (arr: any[]) =>
      arr.reduce((sum, p) => sum + (parseFloat(p.annual_premium) || 0), 0);

    const yourPayoutTotal = calculatePayoutTotal(yourProduction);
    const downlinePayoutTotal = calculatePayoutTotal(downlineProduction);
    const totalPayout = yourPayoutTotal + downlinePayoutTotal;

    const yourProductionTotal = calculateProductionTotal(yourProduction);
    const downlineProductionTotal = calculateProductionTotal(downlineProduction);

    return NextResponse.json({
      success: true,
      payouts: payouts || [],
      production: {
        your: {
          payouts: yourProduction,
          total: yourPayoutTotal,
          productionTotal: yourProductionTotal,
          count: yourProduction.length
        },
        downline: {
          payouts: downlineProduction,
          total: downlinePayoutTotal,
          productionTotal: downlineProductionTotal,
          count: downlineProduction.length
        },
        total: totalPayout,
        totalCount: (payouts || []).length
      },
      filters: {
        start_date,
        end_date,
        carrier_id,
        agent_id
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
