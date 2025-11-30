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
    console.log("[SEARCH-AGENTS] === New search request ===");

    // Parse URL parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limitParam = searchParams.get("limit");
    const searchType = searchParams.get("type") || "downline"; // 'downline' or 'pre-invite'
    const newFormat = searchParams.get("format");

    console.log(
      "[SEARCH-AGENTS] Query:",
      query,
      "Limit:",
      limitParam,
      "Type:",
      searchType,
      "Format:",
      newFormat,
    );

    // Validate query parameter (allow empty for format=options to show all agents)
    const allowEmptyQuery = newFormat === "options";
    const trimmedQuery = query ? query.trim() : "";

    if (!trimmedQuery || trimmedQuery.length < 2) {
      if (!allowEmptyQuery) {
        console.log("[SEARCH-AGENTS] Query too short or missing");
        return NextResponse.json({
          error: "Search query must be at least 2 characters long",
        }, { status: 400 });
      }
    }

    // Validate and set limit (default to 10, max 20 for performance)
    const limit = limitParam ? Math.min(parseInt(limitParam), 20) : 10;
    if (isNaN(limit) || limit <= 0) {
      console.log("[SEARCH-AGENTS] Invalid limit");
      return NextResponse.json({
        error: "Invalid limit parameter",
      }, { status: 400 });
    }

    console.log("[SEARCH-AGENTS] Creating Supabase clients...");
    // Create Supabase clients
    const supabase = createAdminClient();
    const userClient = await createServerClient();

    // Get authenticated user
    console.log("[SEARCH-AGENTS] Getting authenticated user...");
    const { data: { user: authUser } } = await userClient.auth.getUser();

    if (!authUser) {
      console.log("[SEARCH-AGENTS] No authenticated user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[SEARCH-AGENTS] Auth user ID:", authUser.id);

    // Get current user's data
    console.log("[SEARCH-AGENTS] Fetching current user data...");
    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("id, agency_id, perm_level, role")
      .eq("auth_user_id", authUser.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error("[SEARCH-AGENTS] Current user error:", currentUserError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("[SEARCH-AGENTS] Current user:", {
      id: currentUser.id,
      agency_id: currentUser.agency_id,
      perm_level: currentUser.perm_level,
      role: currentUser.role,
    });

    // Check if user is admin
    const isAdmin = currentUser.perm_level === "admin" ||
      currentUser.role === "admin";
    console.log("[SEARCH-AGENTS] Is admin:", isAdmin);

    // Sanitize search query for SQL injection protection
    const finalSanitizedQuery = trimmedQuery
      ? trimmedQuery.replace(/[%_]/g, "\\$&")
      : "";
    console.log("[SEARCH-AGENTS] Sanitized query:", finalSanitizedQuery);

    // Split the search query into individual words for better matching
    const searchWords: string[] = finalSanitizedQuery
      ? finalSanitizedQuery.split(/\s+/).filter((word: string) =>
        word.length > 0
      )
      : [];
    console.log("[SEARCH-AGENTS] Search words:", searchWords);

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

    console.log(
      "[SEARCH-AGENTS] OR conditions:",
      orConditions.length,
      "conditions",
    );
    console.log("[SEARCH-AGENTS] Sample conditions:", orConditions.slice(0, 3));

    let allAgents: any[] = [];

    if (searchType === "pre-invite") {
      // Search for pre-invite users in the agency (for updating existing pre-invite users)
      console.log(
        "[SEARCH-AGENTS] Pre-invite search - querying agency:",
        currentUser.agency_id,
      );

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
      console.log(
        "[SEARCH-AGENTS] Pre-invite search returned",
        allAgents.length,
        "results",
      );
    } else {
      // Search for downline agents (current user + their downline) - for upline selection
      console.log(
        "[SEARCH-AGENTS] Downline search - fetching downline for:",
        currentUser.id,
      );
      console.log("[SEARCH-AGENTS] Auth user ID:", authUser.id);
      console.log(
        "[SEARCH-AGENTS] Current user agency_id:",
        currentUser.agency_id,
      );
      console.log("[SEARCH-AGENTS] Current user role:", currentUser.role);
      console.log(
        "[SEARCH-AGENTS] Current user perm_level:",
        currentUser.perm_level,
      );

      // Test RPC call with detailed error logging
      console.log(
        "[SEARCH-AGENTS] Attempting RPC call to get_agent_downline...",
      );

      let downline: any[] = [];

      try {
        const { data: downlineData, error: downlineError } = await userClient
          .rpc("get_agent_downline", {
            agent_id: currentUser.id,
          });

        console.log("[SEARCH-AGENTS] RPC call completed");
        console.log(
          "[SEARCH-AGENTS] RPC returned data:",
          downlineData ? `${downlineData.length} records` : "null",
        );
        console.log("[SEARCH-AGENTS] RPC returned error:", downlineError);

        if (downlineError) {
          console.error("[SEARCH-AGENTS] ===== RPC ERROR DETAILS =====");
          console.error("[SEARCH-AGENTS] Error code:", downlineError.code);
          console.error(
            "[SEARCH-AGENTS] Error message:",
            downlineError.message,
          );
          console.error(
            "[SEARCH-AGENTS] Error details:",
            downlineError.details,
          );
          console.error("[SEARCH-AGENTS] Error hint:", downlineError.hint);
          console.error(
            "[SEARCH-AGENTS] Full error object:",
            JSON.stringify(downlineError, null, 2),
          );
          console.error("[SEARCH-AGENTS] ===========================");

          return NextResponse.json({
            error: "Failed to fetch downline",
            detail: downlineError.message,
            code: downlineError.code,
            hint: downlineError.hint,
            debugInfo: {
              userId: currentUser.id,
              authUserId: authUser.id,
              agencyId: currentUser.agency_id,
              role: currentUser.role,
              permLevel: currentUser.perm_level,
            },
          }, { status: 500 });
        }

        downline = downlineData || [];
      } catch (rpcException) {
        console.error("[SEARCH-AGENTS] ===== RPC EXCEPTION =====");
        console.error("[SEARCH-AGENTS] Exception:", rpcException);
        console.error("[SEARCH-AGENTS] Exception type:", typeof rpcException);
        console.error(
          "[SEARCH-AGENTS] Exception message:",
          rpcException instanceof Error ? rpcException.message : "Unknown",
        );
        console.error(
          "[SEARCH-AGENTS] Exception stack:",
          rpcException instanceof Error ? rpcException.stack : "No stack",
        );
        console.error("[SEARCH-AGENTS] ========================");

        throw rpcException;
      }

      // Include current user + all their downline
      const visibleAgentIds = [
        currentUser.id,
        ...((downline as any[])?.map((u: any) => u.id) || []),
      ];
      console.log(
        "[SEARCH-AGENTS] Found",
        visibleAgentIds.length,
        "visible agents (self + downline)",
      );

      // Query only these visible agents with active/invited status
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
        .in("status", ["active", "invited"])
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
      console.log(
        "[SEARCH-AGENTS] Downline search returned",
        allAgents.length,
        "results",
      );
    }

    // Client-side filtering for multi-word searches to ensure all words match
    let filteredAgents = allAgents || [];

    // Only filter if we have search words
    if (searchWords.length > 1 && finalSanitizedQuery) {
      console.log(
        "[SEARCH-AGENTS] Filtering",
        filteredAgents.length,
        "results for multi-word match",
      );
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
      console.log(
        "[SEARCH-AGENTS] After filtering:",
        filteredAgents.length,
        "results",
      );
    }

    // Apply the limit after filtering
    const agents = filteredAgents.slice(0, limit);
    console.log("[SEARCH-AGENTS] Returning", agents.length, "agents");

    // Check if format parameter is set to 'options' for select components
    if (newFormat === "options") {
      // Transform to {value, label} format for select components
      const options = agents.map((agent) => ({
        value: agent.id,
        label: `${agent.first_name} ${agent.last_name}${
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
