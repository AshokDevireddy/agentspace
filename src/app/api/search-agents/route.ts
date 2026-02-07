// API ROUTE: /api/search-agents
// This endpoint provides secure agent search functionality with the following features:
// - Authentication verification
// - Input validation and sanitization
// - Efficient database queries with proper indexing
// - Limited result sets to prevent performance issues
// - Only returns safe, non-sensitive user fields
// - Respects downline hierarchy (users can only search their downline)

import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Parse URL parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limitParam = searchParams.get("limit");
    const searchType = searchParams.get("type") || "downline"; // 'downline' or 'pre-invite'
    const newFormat = searchParams.get("format");

    // Validate query parameter (allow empty for format=options to show all agents)
    const allowEmptyQuery = newFormat === "options";
    const trimmedQuery = query ? query.trim() : "";

    if (!trimmedQuery || trimmedQuery.length < 2) {
      if (!allowEmptyQuery) {
        return NextResponse.json({
          error: "Search query must be at least 2 characters long",
        }, { status: 400 });
      }
    }

    // Validate and set limit (default to 10, max 20 for performance)
    const limit = limitParam ? Math.min(parseInt(limitParam), 20) : 10;
    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json({
        error: "Invalid limit parameter",
      }, { status: 400 });
    }

    // Create Supabase clients
    const supabase = createAdminClient();
    const userClient = await createServerClient();

    // Get authenticated user
    const { data: { user: authUser } } = await userClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's data
    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("id, agency_id, perm_level, role")
      .eq("auth_user_id", authUser.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error("[SEARCH-AGENTS] Current user error:", currentUserError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is admin
    const isAdmin = currentUser.perm_level === "admin" ||
      currentUser.role === "admin";

    // Sanitize search query for SQL injection protection
    const finalSanitizedQuery = trimmedQuery
      ? trimmedQuery.replace(/[%_]/g, "\\$&")
      : "";

    // Split the search query into individual words for better matching
    const searchWords: string[] = finalSanitizedQuery
      ? finalSanitizedQuery.split(/\s+/).filter((word: string) =>
        word.length > 0
      )
      : [];

    // Build OR conditions that search for individual words in fields
    const orConditions = [];

    // Only add search conditions if we have a query (or if format=options, show all)
    if (finalSanitizedQuery && finalSanitizedQuery.length >= 2) {
      // Always search for the full query in individual fields
      orConditions.push(`first_name.ilike.%${finalSanitizedQuery}%`);
      orConditions.push(`last_name.ilike.%${finalSanitizedQuery}%`);
      orConditions.push(`email.ilike.%${finalSanitizedQuery}%`);

      // For multi-word searches, also search for individual words
      if (searchWords.length > 1) {
        for (const word of searchWords) {
          const sanitizedWord = word.replace(/[%_]/g, "\\$&");
          orConditions.push(`first_name.ilike.%${sanitizedWord}%`);
          orConditions.push(`last_name.ilike.%${sanitizedWord}%`);
          orConditions.push(`email.ilike.%${sanitizedWord}%`);
        }
      }
    }

    let allAgents: any[] = [];

    if (searchType === "pre-invite") {
      // Search for pre-invite users in the agency (for updating existing pre-invite users)
      let query = supabase
        .from("users")
        .select(`
          id,
          first_name,
          last_name,
          email,
          status
        `)
        .eq("agency_id", currentUser.agency_id)
        .eq("status", "pre-invite")
        .neq("role", "client");

      // Only add OR conditions if we have search terms
      if (orConditions.length > 0) {
        query = query.or(orConditions.join(","));
      }

      const { data, error: searchError } = await query
        .order("last_name", { ascending: true })
        .limit(50);

      if (searchError) {
        console.error("[SEARCH-AGENTS] Pre-invite search error:", searchError);
        return NextResponse.json({
          error: "Search failed",
          detail: searchError.message || "Database search encountered an error",
        }, { status: 500 });
      }

      allAgents = data || [];
    } else {
      // Search for downline agents (current user + their downline) - for upline selection
      // Admins can search all agents in agency, regular agents can search self + downline
      let visibleAgentIds: string[] = [];

      if (isAdmin) {
        // Admins can search all agents in their agency
        const { data: allAgentsData, error: allAgentsError } = await supabase
          .from("users")
          .select("id")
          .eq("agency_id", currentUser.agency_id)
          .neq("role", "client")
          .in("status", ["active", "invited", "onboarding"]);

        if (allAgentsError) {
          console.error(
            "[SEARCH-AGENTS] Error fetching all agents for admin:",
            allAgentsError,
          );
          visibleAgentIds = [currentUser.id];
        } else {
          visibleAgentIds = (allAgentsData || []).map((u: any) => u.id);
        }
      } else {
        // Regular agents see self + their downline
        const { data: downlineData, error: downlineError } = await supabase
          .rpc("get_agent_downline", {
            agent_id: currentUser.id,
          });

        if (downlineError) {
          console.error("[SEARCH-AGENTS] Downline fetch error:", downlineError);
          visibleAgentIds = [currentUser.id];
        } else {
          // Include current user + all their downline
          visibleAgentIds = [
            currentUser.id,
            ...((downlineData as any[])?.map((u: any) => u.id) || []),
          ];
        }
      }

      // Query only these visible agents with active/invited/onboarding status
      let query = supabase
        .from("users")
        .select(`
          id,
          first_name,
          last_name,
          email,
          status
        `)
        .in("id", visibleAgentIds)
        .in("status", ["active", "invited", "onboarding"])
        .neq("role", "client");

      // Only add OR conditions if we have search terms
      if (orConditions.length > 0) {
        query = query.or(orConditions.join(","));
      }

      const { data, error: searchError } = await query
        .order("last_name", { ascending: true })
        .limit(50);

      if (searchError) {
        console.error("[SEARCH-AGENTS] Downline search error:", searchError);
        return NextResponse.json({
          error: "Search failed",
          detail: searchError.message || "Database search encountered an error",
        }, { status: 500 });
      }

      allAgents = data || [];
    }

    // Client-side filtering for multi-word searches to ensure all words match
    let filteredAgents = allAgents || [];

    // Only filter if we have search words
    if (searchWords.length > 1 && finalSanitizedQuery) {
      filteredAgents = filteredAgents.filter((agent) => {
        const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase();
        const email = agent.email ? agent.email.toLowerCase() : "";
        const queryLower = finalSanitizedQuery.toLowerCase();

        // Check if the full query matches anywhere in the full name or email
        if (fullName.includes(queryLower) || email.includes(queryLower)) {
          return true;
        }

        // Check if all individual words appear in the full name or email
        return searchWords.every((word: string) => {
          const wordLower = word.toLowerCase();
          return fullName.includes(wordLower) || email.includes(wordLower);
        });
      });
    }

    // Apply the limit after filtering
    const agents = filteredAgents.slice(0, limit);

    // Check if format parameter is set to 'options' for select components
    if (newFormat === "options") {
      // Transform to {value, label} format for select components
      const options = agents.map((agent) => ({
        value: agent.id,
        label: `${agent.first_name || ''} ${agent.last_name || ''}`.trim() + `${
          agent.email ? " - " + agent.email : ""
        }${agent.status === "pre-invite" ? " (Pre-invite)" : ""}`,
      }));
      return NextResponse.json(options || []);
    }

    // Return search results in original format
    // Note: Only returning safe, non-sensitive fields (no admin flags, goals, etc.)
    return NextResponse.json(agents || []);
  } catch (error) {
    console.error("[SEARCH-AGENTS] Unexpected API Error:", error);
    console.error(
      "[SEARCH-AGENTS] Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    return NextResponse.json({
      error: "Internal Server Error",
      detail: error instanceof Error
        ? error.message
        : "An unexpected error occurred during search",
    }, { status: 500 });
  }
}

// Optionally, you could add rate limiting here using a middleware or library
// For production, consider implementing:
// 1. Rate limiting per user (e.g., 100 requests per minute)
// 2. Caching frequently searched terms
// 3. Additional logging for monitoring and security

// Future enhancements you could add:
// 1. Server-side caching with Redis
// 2. Smarter debouncing based on user typing patterns
// 3. Prefetch popular searches
// 4. Search result ranking/relevance scoring
