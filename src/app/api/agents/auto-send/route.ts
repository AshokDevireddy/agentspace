// API ROUTE: /api/agents/auto-send
// Returns agents for the current user's agency with their sms_auto_send_enabled status
// Used by the Configuration > Automation tab for per-agent override management

import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseUser = await createServerClient();
    const supabaseAdmin = createAdminClient();

    // Authenticate
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up current user's agency_id server-side (same pattern as /api/agents)
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from("users")
      .select("id, agency_id, perm_level, role")
      .eq("auth_user_id", user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error("Current user fetch error:", currentUserError);
      return NextResponse.json({
        error: "Failed to fetch current user",
        detail: currentUserError?.message || "User not found",
      }, { status: 500 });
    }

    // Verify user is admin
    const isAdmin = currentUser.perm_level === "admin" || currentUser.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!currentUser.agency_id) {
      return NextResponse.json({ error: "User has no agency" }, { status: 400 });
    }

    // Fetch agents from the same agency with only the fields needed for auto-send management
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, email, sms_auto_send_enabled")
      .eq("agency_id", currentUser.agency_id)
      .in("role", ["agent", "admin"])
      .order("last_name");

    if (agentsError) {
      console.error("Agents fetch error:", agentsError);
      return NextResponse.json({
        error: "Failed to fetch agents",
        detail: agentsError.message,
      }, { status: 500 });
    }

    return NextResponse.json({ agents: agents ?? [] });
  } catch (error) {
    console.error("API Error in agents auto-send:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred",
    }, { status: 500 });
  }
}
