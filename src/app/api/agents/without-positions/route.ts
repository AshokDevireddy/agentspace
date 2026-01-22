// API ROUTE: /api/agents/without-positions
// This endpoint fetches agents who don't have a position assigned yet
// Admins see all agents in their agency, agents see their downlines

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

    // Get search query parameter
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q")?.trim() || "";
    const fetchAll = searchQuery === "*" || searchParams.get("all") === "true";

    // If there's a search query (or fetchAll flag), fetch all agents (with or without positions) that match
    if (searchQuery || fetchAll) {
      // Use RPC function to get all agents for position management (includes those with positions)
      const { data: allAgents, error: allAgentsError } = await supabase
        .rpc("get_agents_without_positions", { p_user_id: userId });

      console.log("get_agents_without_positions RPC response (with search):", {
        userId,
        dataLength: allAgents?.length || 0,
        firstFewItems: allAgents?.slice(0, 3),
        fullData: allAgents,
        error: allAgentsError,
      });

      if (allAgentsError) {
        return NextResponse.json({
          error: "Failed to fetch agents",
          detail:
            `Database query encountered an error: ${allAgentsError.message}`,
          details: allAgentsError.details,
          hint: allAgentsError.hint,
          code: allAgentsError.code,
        }, { status: 500 });
      }

      // SEARCH_FOR_THIS: Also fetch agents with positions for search - THIS IS WHY AGENTS WITH POSITIONS SHOW UP
      // Also fetch agents with positions for search
      const { data: userDataFull } = await supabase
        .from("users")
        .select("id, role, is_admin, perm_level, agency_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!userDataFull) {
        return NextResponse.json({
          error: "User not found",
          detail: "Failed to fetch user information",
        }, { status: 404 });
      }

      const isAdmin = userDataFull.is_admin ||
        userDataFull.perm_level === "admin" || userDataFull.role === "admin";

      // Fetch all agents (with positions) that the user can manage
      let agentsWithPositionsQuery = supabase
        .from("users")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone_number,
          role,
          position_id,
          created_at,
          position:positions(name),
          upline_id,
          upline:users!upline_id(first_name, last_name)
        `)
        .in("role", ["agent", "admin"]) // Include both agents and admins
        .eq("is_active", true) // Only fetch active users
        .order("created_at", { ascending: false });

      // Apply visibility rules: admins see all in agency, agents see their downlines
      if (!isAdmin) {
        // For non-admins, we need to get their downlines
        const { data: downlineData, error: downlineError } = await supabase
          .rpc("get_agent_downline", { agent_id: userId });

        if (downlineError) {
          // Fallback to only themselves if downline fetch fails
          agentsWithPositionsQuery = agentsWithPositionsQuery.eq("id", userId);
        } else if (downlineData && downlineData.length > 0) {
          const downlineIds = downlineData.map((d: any) => d.agent_id);
          // Always include the user themselves in the list (even if they're in downline)
          if (!downlineIds.includes(userId)) {
            downlineIds.push(userId);
          }
          agentsWithPositionsQuery = agentsWithPositionsQuery.in(
            "id",
            downlineIds,
          );
        } else {
          agentsWithPositionsQuery = agentsWithPositionsQuery.eq("id", userId); // Only themselves
        }
      } else {
        // Admins see all agents in their agency (including themselves)
        agentsWithPositionsQuery = agentsWithPositionsQuery.eq(
          "agency_id",
          userDataFull.agency_id,
        );
      }

      const { data: agentsWithPositions, error: withPositionsError } =
        await agentsWithPositionsQuery;

      if (withPositionsError) {
        // Continue with just agents without positions if this fails
      }

      // Always fetch the current user separately to ensure they're included if they have a position
      // This handles cases where the user might not be in the main query results (e.g., role mismatch)
      const { data: currentUserData } = await supabase
        .from("users")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone_number,
          role,
          position_id,
          created_at,
          position:positions(name),
          upline_id,
          upline:users!upline_id(first_name, last_name)
        `)
        .eq("id", userId)
        .single();

      // Check if current user is already in the agentsWithPositions list
      const currentUserInResults = agentsWithPositions?.some((a: any) =>
        a.id === userId
      );
      const currentUserWithPosition =
        currentUserData && currentUserData.position_id && !currentUserInResults
          ? currentUserData
          : null;

      // SEARCH_FOR_THIS: Combine both lists and filter by search query - THIS IS WHERE AGENTS WITH POSITIONS GET ADDED TO THE LIST
      // Combine both lists and filter by search query
      const allAgentsList = [
        ...(allAgents || []).map((a: any) => {
          return { ...a, has_position: false };
        }),
        ...(agentsWithPositions || []).map((a: any) => {
          return {
            agent_id: a.id,
            first_name: a.first_name,
            last_name: a.last_name,
            email: a.email,
            phone_number: a.phone_number,
            role: a.role,
            upline_name: a.upline && a.upline.first_name && a.upline.last_name
              ? `${a.upline.first_name} ${a.upline.last_name}`
              : null,
            created_at: a.created_at,
            position_id: a.position_id,
            position_name: a.position?.name || null,
            has_position: !!a.position_id,
          };
        }),
        // Explicitly add current user if they have a position and weren't in the results
        ...(currentUserWithPosition
          ? [{
            agent_id: currentUserWithPosition.id,
            first_name: currentUserWithPosition.first_name,
            last_name: currentUserWithPosition.last_name,
            email: currentUserWithPosition.email,
            phone_number: currentUserWithPosition.phone_number,
            role: currentUserWithPosition.role,
            upline_name: currentUserWithPosition.upline &&
                currentUserWithPosition.upline.first_name &&
                currentUserWithPosition.upline.last_name
              ? `${currentUserWithPosition.upline.first_name} ${currentUserWithPosition.upline.last_name}`
              : null,
            created_at: currentUserWithPosition.created_at,
            position_id: currentUserWithPosition.position_id,
            position_name: currentUserWithPosition.position?.name || null,
            has_position: !!currentUserWithPosition.position_id,
          }]
          : []),
      ];

      // Remove duplicates (agents might appear in both lists)
      const uniqueAgents = Array.from(
        new Map(allAgentsList.map((a: any) => [a.agent_id, a])).values(),
      );

      // Filter by search query (case-insensitive search on name or email)
      // Skip filtering if fetchAll is true (return all agents)
      const filteredAgents = fetchAll
        ? uniqueAgents
        : uniqueAgents.filter((agent: any) => {
          const searchLower = searchQuery.toLowerCase();
          const fullName = `${agent.first_name} ${agent.last_name}`
            .toLowerCase();
          const email = (agent.email || "").toLowerCase();
          return fullName.includes(searchLower) || email.includes(searchLower);
        });

      // Count agents without positions for the badge
      const withoutPositionsCount = (allAgents || []).length;

      return NextResponse.json({
        agents: filteredAgents,
        count: withoutPositionsCount, // Badge count is still only those without positions
      });
    }

    // No search query - return only agents without positions (original behavior)
    const { data: agents, error: fetchError } = await supabase
      .rpc("get_agents_without_positions", { p_user_id: userId });

    console.log("get_agents_without_positions RPC response (no search):", {
      userId,
      dataLength: agents?.length || 0,
      firstFewItems: agents?.slice(0, 3),
      fullData: agents,
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

    // Return agents with count
    const agentList = (agents || []).map((a: any) => ({
      ...a,
      has_position: false,
    }));
    return NextResponse.json({
      agents: agentList,
      count: agentList.length,
    });
  } catch (error) {
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while fetching agents",
    }, { status: 500 });
  }
}
