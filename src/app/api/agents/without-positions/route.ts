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

      if (allAgentsError) {
        console.error("Agents fetch error:", {
          message: allAgentsError.message,
          details: allAgentsError.details,
          hint: allAgentsError.hint,
          code: allAgentsError.code,
        });
        return NextResponse.json({
          error: "Failed to fetch agents",
          detail:
            `Database query encountered an error: ${allAgentsError.message}`,
          details: allAgentsError.details,
          hint: allAgentsError.hint,
          code: allAgentsError.code,
        }, { status: 500 });
      }

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
        .eq("role", "agent")
        .order("created_at", { ascending: false });

      // Apply visibility rules: admins see all in agency, agents see their downlines
      if (!isAdmin) {
        // For non-admins, we need to get their downlines
        const { data: downlineData, error: downlineError } = await supabase
          .rpc("get_agent_downline", { p_agent_id: userId });

        if (downlineError) {
          console.error("Error fetching downline:", downlineError);
          // Fallback to only themselves if downline fetch fails
          agentsWithPositionsQuery = agentsWithPositionsQuery.eq("id", userId);
        } else if (downlineData && downlineData.length > 0) {
          const downlineIds = downlineData.map((d: any) => d.agent_id);
          // Include the user themselves in the list
          downlineIds.push(userId);
          agentsWithPositionsQuery = agentsWithPositionsQuery.in(
            "id",
            downlineIds,
          );
        } else {
          agentsWithPositionsQuery = agentsWithPositionsQuery.eq("id", userId); // Only themselves
        }
      } else {
        // Admins see all agents in their agency
        agentsWithPositionsQuery = agentsWithPositionsQuery.eq(
          "agency_id",
          userDataFull.agency_id,
        );
      }

      const { data: agentsWithPositions, error: withPositionsError } =
        await agentsWithPositionsQuery;

      if (withPositionsError) {
        console.error(
          "Error fetching agents with positions:",
          withPositionsError,
        );
        // Continue with just agents without positions if this fails
      }

      // Combine both lists and filter by search query
      const allAgentsList = [
        ...(allAgents || []).map((a: any) => {
          console.log(
            "[API] Agent without position - created_at:",
            a.created_at,
            "Type:",
            typeof a.created_at,
          );
          return { ...a, has_position: false };
        }),
        ...(agentsWithPositions || []).map((a: any) => {
          console.log(
            "[API] Agent with position - id:",
            a.id,
            "created_at:",
            a.created_at,
            "Type:",
            typeof a.created_at,
            "Full object:",
            JSON.stringify(a, null, 2),
          );
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

    if (fetchError) {
      console.error("Agents without positions fetch error:", {
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code,
      });
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
    console.error("API Error in agents without positions:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while fetching agents",
    }, { status: 500 });
  }
}
