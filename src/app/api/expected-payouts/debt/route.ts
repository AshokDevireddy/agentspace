import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/expected-payouts/debt
 * Fetches debt calculation for an agent from lapsed policies
 *
 * Query Parameters:
 * - agent_id: Optional agent ID (defaults to current user)
 *
 * Debt Calculation Rules:
 * - Within 30 days of effective date: Full commission is debt (100% refund)
 * - After 30 days: Prorated over 9-month vesting period
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
    const agent_id = searchParams.get('agent_id') || userData.id;

    // Call the RPC function
    const { data: debtData, error: rpcError } = await supabase
      .rpc('get_agent_debt', {
        p_user_id: userData.id,
        p_agent_id: agent_id
      });

    if (rpcError) {
      console.error('[Agent Debt] RPC error:', {
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code
      });
      return NextResponse.json(
        {
          error: `Failed to fetch agent debt: ${rpcError.message}`,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        },
        { status: 500 }
      );
    }

    // RPC returns array with single row
    const result = debtData?.[0] || {
      total_debt: 0,
      lapsed_deals_count: 0,
      debt_breakdown: []
    };

    return NextResponse.json({
      success: true,
      debt: {
        total: result.total_debt || 0,
        lapsedDealsCount: result.lapsed_deals_count || 0,
        breakdown: result.debt_breakdown || []
      },
      agent_id,
      user: {
        id: userData.id,
        name: `${userData.first_name} ${userData.last_name}`,
        role: userData.role
      }
    });

  } catch (err: any) {
    console.error('[Agent Debt] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch agent debt" },
      { status: 500 }
    );
  }
}
