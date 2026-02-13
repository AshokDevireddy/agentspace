// API ROUTE: /api/agents/downlines
// This endpoint fetches the downlines for a specific agent

import { NextResponse } from "next/server";
import { authenticateRoute, authorizeAgentAccess, isAuthError } from "@/lib/auth/route-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({
        error: "Missing agent ID",
        detail: "Agent ID is required",
      }, { status: 400 });
    }

    // Authenticate and authorize
    const authResult = await authenticateRoute();
    if (isAuthError(authResult)) return authResult;

    const accessResult = await authorizeAgentAccess(authResult.supabaseAdmin, authResult.user, agentId);
    if (accessResult !== true) return accessResult;

    const supabase = authResult.supabaseAdmin;

    // Fetch downlines with their details
    const { data: downlines, error } = await supabase
      .from("users")
      .select(`
        id,
        first_name,
        last_name,
        position_id,
        status,
        created_at,
        position:positions(name, level)
      `)
      .eq("upline_id", agentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Downlines fetch error:", error);
      return NextResponse.json({
        error: "Failed to fetch downlines",
        detail: "Database query encountered an error",
      }, { status: 500 });
    }

    // Get debt/production metrics for downlines (YTD by default)
    const downlineIds = (downlines || []).map((d: any) => d.id);
    let metricsMap: Record<string, any> = {};

    if (downlineIds.length > 0) {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
      const endDate = new Date(now.getFullYear() + 1, 0, 1); // Jan 1 of next year

      const { data: metricsData, error: metricsError } = await supabase.rpc(
        "get_agents_debt_production_v3",
        {
          p_user_id: agentId, // Use the parent agent ID as the user
          p_agent_ids: downlineIds,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
        }
      );

      if (metricsError) {
        console.error("Metrics fetch error:", metricsError);
        // Don't fail the request, just log and continue without metrics
      } else if (metricsData) {
        metricsData.forEach((row: any) => {
          metricsMap[row.agent_id] = row;
        });
      }
    }

    // Format the downlines data
    const formattedDownlines = (downlines || []).map((downline: any) => {
      const metrics = metricsMap[downline.id] || {};
      return {
        id: downline.id,
        name: `${downline.first_name} ${downline.last_name}`,
        position: downline.position?.name || null,
        position_level: downline.position?.level || null,
        badge: downline.position?.name || "Agent",
        status: downline.status || "active",
        created_at: downline.created_at,
        // Add production/debt metrics
        individual_debt: Number(metrics.individual_debt || 0),
        individual_debt_count: Number(metrics.individual_debt_count || 0),
        individual_production: Number(metrics.individual_production || 0),
        individual_production_count: Number(metrics.individual_production_count || 0),
        hierarchy_debt: Number(metrics.hierarchy_debt || 0),
        hierarchy_debt_count: Number(metrics.hierarchy_debt_count || 0),
        hierarchy_production: Number(metrics.hierarchy_production || 0),
        hierarchy_production_count: Number(metrics.hierarchy_production_count || 0),
        debt_to_production_ratio: metrics.debt_to_production_ratio != null
          ? Number(metrics.debt_to_production_ratio)
          : null,
      };
    });

    return NextResponse.json({
      agentId,
      downlines: formattedDownlines,
      downlineCount: formattedDownlines.length,
    });
  } catch (error) {
    console.error("API Error in downlines:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while fetching downlines",
    }, { status: 500 });
  }
}
