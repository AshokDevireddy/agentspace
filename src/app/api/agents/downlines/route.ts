// API ROUTE: /api/agents/downlines
// This endpoint fetches the downlines for a specific agent

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    const supabase = createAdminClient();

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

    // Format the downlines data
    const formattedDownlines = (downlines || []).map((downline: any) => ({
      id: downline.id,
      name: `${downline.first_name} ${downline.last_name}`,
      position: downline.position?.name || "Agent",
      badge: downline.position?.name || "Agent",
      status: downline.status || "active",
      created_at: downline.created_at,
    }));

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
