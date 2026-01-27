// API ROUTE: /api/agents/without-positions
// This endpoint fetches all agents that the user can manage for position assignment
// Admins see all agents in their agency, agents see their downlines
// Returns both agents with and without positions, sorted with agents without positions first

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();

    // Get the authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({
        error: "Unauthorized",
        detail: "No valid token provided",
      }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify the token and get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      token,
    );

    if (userError || !user) {
      return NextResponse.json({
        error: "Unauthorized",
        detail: "Invalid token",
      }, { status: 401 });
    }

    // Get the user's id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json({
        error: "User not found",
        detail: "Failed to fetch user information",
      }, { status: 404 });
    }

    const { id: userId } = userData;

    // Get search query parameter for filtering results
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q")?.trim() || "";

    // Use RPC function to get all agents for position management
    // The RPC now returns ALL agents (with and without positions) that the user can manage
    // Sorted with agents without positions first
    const { data: agents, error: fetchError } = await supabase
      .rpc("get_agents_without_positions", { p_user_id: userId });

    console.log("get_agents_without_positions RPC response:", {
      userId,
      dataLength: agents?.length || 0,
      firstFewItems: agents?.slice(0, 3),
      error: fetchError,
    });

    if (fetchError) {
      return NextResponse.json({
        error: "Failed to fetch agents",
        detail: `Database query encountered an error: ${fetchError.message}`,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code,
      }, { status: 500 });
    }

    // Filter by search query if provided (case-insensitive search on name or email)
    let filteredAgents = agents || [];
    if (searchQuery) {
      filteredAgents = filteredAgents.filter((agent: any) => {
        const searchLower = searchQuery.toLowerCase();
        const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase();
        const email = (agent.email || "").toLowerCase();
        return fullName.includes(searchLower) || email.includes(searchLower);
      });
    }

    // Count agents without positions for the badge
    const withoutPositionsCount = (agents || []).filter((a: any) => !a.has_position).length;

    return NextResponse.json({
      agents: filteredAgents,
      count: withoutPositionsCount, // Badge count is only those without positions
    });
  } catch (error) {
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while fetching agents",
    }, { status: 500 });
  }
}
