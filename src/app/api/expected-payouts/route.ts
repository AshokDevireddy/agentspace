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

    // Call the RPC function
    const { data: payouts, error: rpcError } = await supabase
      .rpc('get_expected_payouts', {
        p_user_id: userData.id,
        p_agent_id: agent_id,
        p_months_past: months_past,
        p_months_future: months_future,
        p_carrier_id: carrier_id
      });

    console.log('payouts', payouts, userData.id, agent_id, months_past, months_future, carrier_id);

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

    return NextResponse.json({
      success: true,
      payouts: payouts || [],
      filters: {
        months_past,
        months_future,
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
