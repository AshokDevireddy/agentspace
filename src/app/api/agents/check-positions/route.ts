import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/agents/check-positions
 * Checks if the current user and their entire upline have positions assigned
 * Required for posting deals
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

    // Call the RPC function to check positions
    const { data: checkResult, error: rpcError } = await supabase
      .rpc('check_agent_upline_positions', { p_agent_id: userData.id });

    if (rpcError) {
      console.error('[Check Positions] RPC error:', {
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code
      });
      return NextResponse.json(
        {
          error: `Failed to check positions: ${rpcError.message}`,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      has_all_positions: checkResult.has_all_positions,
      missing_positions: checkResult.missing_positions,
      total_checked: checkResult.total_checked || 0,
      user: {
        id: userData.id,
        name: `${userData.first_name} ${userData.last_name}`,
        role: userData.role
      }
    });

  } catch (err: any) {
    console.error('[Check Positions] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || "Failed to check positions" },
      { status: 500 }
    );
  }
}
