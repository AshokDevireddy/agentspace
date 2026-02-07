// API ROUTE: /api/agents/[id]
// This endpoint fetches and updates agent information by ID

import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params;

    if (!agentId) {
      return NextResponse.json({
        error: "Missing agent ID",
        detail: "Agent ID is required",
      }, { status: 400 });
    }

    // Get date range from query parameters
    const { searchParams } = new URL(request.url);
    const startMonthParam = searchParams.get("startMonth");
    const endMonthParam = searchParams.get("endMonth");

    const supabase = createAdminClient();

    // Get agent information
    const { data: agent, error: agentError } = await supabase
      .from("users")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone_number,
        role,
        position_id,
        upline_id,
        created_at,
        is_active,
        status,
        total_prod,
        total_policies_sold
      `)
      .eq("id", agentId)
      .single();

    if (agentError) {
      console.error("Agent fetch error:", agentError);
      return NextResponse.json({
        error: "Failed to fetch agent",
        detail: "Database query encountered an error",
      }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({
        error: "Agent not found",
        detail: "No agent found with the provided ID",
      }, { status: 404 });
    }

    // Get position name and level
    let positionName = "Unknown";
    let positionLevel = null;
    if (agent.position_id) {
      const { data: position } = await supabase
        .from("positions")
        .select("name, level")
        .eq("id", agent.position_id)
        .single();
      positionName = position?.name || "Unknown";
      positionLevel = position?.level || null;
    }

    // Get upline name
    let uplineName = "None";
    if (agent.upline_id) {
      const { data: upline } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", agent.upline_id)
        .single();
      uplineName = upline
        ? `${upline.last_name}, ${upline.first_name}`
        : "None";
    }

    // Count downlines
    const { count: downlineCount, error: downlineError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("upline_id", agentId);

    if (downlineError) {
      console.error("Downlines count error:", downlineError);
    }

    // Calculate date range for production metrics
    let startDate: Date;
    let endDate: Date;
    const now = new Date();

    if (startMonthParam && endMonthParam) {
      // Parse "YYYY-MM" format from query params
      const [startYear, startMonthNum] = startMonthParam.split("-").map(Number);
      const [endYear, endMonthNum] = endMonthParam.split("-").map(Number);
      startDate = new Date(startYear, startMonthNum - 1, 1); // First day of start month
      endDate = new Date(endYear, endMonthNum, 1); // First day of month AFTER end month
    } else {
      // Default: current year (Jan 1 to Dec 31) - YTD
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear() + 1, 0, 1);
    }

    // Fetch production/debt metrics using the same RPC as the table
    const { data: metricsData, error: metricsError } = await supabase.rpc(
      "get_agents_debt_production_v3",
      {
        p_user_id: agentId, // Use the agent's ID as the user
        p_agent_ids: [agentId],
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      },
    );

    // Extract metrics from RPC result
    const metrics = metricsData?.[0] || {};
    const individual_production = Number(metrics.individual_production || 0);
    const individual_debt = Number(metrics.individual_debt || 0);
    const hierarchy_production = Number(metrics.hierarchy_production || 0);
    const hierarchy_debt = Number(metrics.hierarchy_debt || 0);

    if (metricsError) {
      console.error("Metrics fetch error:", metricsError);
      // Continue without metrics rather than failing the whole request
    }

    // Generate random earnings between $50 and $500
    const randomEarnings = Math.floor(Math.random() * 451) + 50;
    const totalProd = parseFloat(agent.total_prod?.toString() || "0");
    const earnings = `$${randomEarnings.toFixed(2)} / $${totalProd.toFixed(2)}`;

    // Generate random last login date (max 2 days before today)
    const today = new Date();
    const maxDaysAgo = 2;
    const randomDaysAgo = Math.floor(Math.random() * (maxDaysAgo + 1));
    const lastLoginDate = new Date(today);
    lastLoginDate.setDate(today.getDate() - randomDaysAgo);
    const lastLogin = lastLoginDate.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const formattedAgent = {
      id: agent.id,
      name: [agent.last_name, agent.first_name].filter(Boolean).join(', '),
      email: agent.email || null,
      phone_number: agent.phone_number || null,
      role: agent.role || null,
      position: positionName,
      position_id: agent.position_id || null,
      position_level: positionLevel,
      upline: uplineName,
      upline_id: agent.upline_id || null,
      created: new Date(agent.created_at || "").toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      lastLogin: lastLogin,
      earnings: earnings,
      downlines: downlineCount || 0,
      status: agent.status || "pre-invite",
      badge: positionName,
      is_active: agent.is_active ?? true,
      // Add production/debt metrics
      individual_debt: individual_debt,
      individual_debt_count: Number(metrics.individual_debt_count || 0),
      individual_production: individual_production,
      individual_production_count: Number(
        metrics.individual_production_count || 0,
      ),
      hierarchy_debt: hierarchy_debt,
      hierarchy_debt_count: Number(metrics.hierarchy_debt_count || 0),
      hierarchy_production: hierarchy_production,
      hierarchy_production_count: Number(
        metrics.hierarchy_production_count || 0,
      ),
      debt_to_production_ratio: metrics.debt_to_production_ratio != null
        ? Number(metrics.debt_to_production_ratio)
        : null,
    };

    return NextResponse.json(formattedAgent);
  } catch (error) {
    console.error("API Error in agent by ID:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while fetching agent",
    }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params;

    if (!agentId) {
      return NextResponse.json({
        error: "Missing agent ID",
        detail: "Agent ID is required",
      }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const supabaseUser = await createServerClient();

    // Check if user is authenticated
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user info
    const { data: currentUser } = await supabaseAdmin
      .from("users")
      .select("id, is_admin, perm_level, role, agency_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is admin (check all admin indicators)
    const isAdmin = currentUser.is_admin ||
      currentUser.perm_level === "admin" ||
      currentUser.role === "admin";

    // If not admin, check if the agent being edited is in the current user's downline tree
    if (!isAdmin) {
      // Get all downlines for the current user (includes direct and indirect)
      const { data: downlines, error: downlineError } = await supabaseAdmin
        .rpc("get_agent_downline", {
          agent_id: currentUser.id,
        });

      if (downlineError) {
        console.error("Downline fetch error:", downlineError);
        return NextResponse.json({
          error: "Failed to verify permissions",
          detail: "Could not check downline relationships",
        }, { status: 500 });
      }

      // Check if the agent being edited is in the downline tree
      const downlineIds = (downlines as { id: string }[])?.map((d) => d.id) || [];
      const isInDownline = downlineIds.includes(agentId);

      if (!isInDownline) {
        return NextResponse.json({
          error: "Forbidden",
          detail: "You can only edit agents in your downline tree",
        }, { status: 403 });
      }
    }

    const body = await request.json();
    const { email, phone_number, role, status, upline_id, is_active, sms_auto_send_enabled } = body;

    // Build update object with only fields that are actually being updated
    // Only include fields that are explicitly provided and have meaningful values
    const updateData: Record<string, unknown> = {};

    // Only update email if it's provided and not an empty string (empty string means clear it, set to null)
    if (email !== undefined) {
      updateData.email = email === "" || email === null ? null : email;
    }

    // Only update phone_number if it's provided
    if (phone_number !== undefined) {
      updateData.phone_number = phone_number === "" || phone_number === null
        ? null
        : phone_number;
    }

    // Only update role if it's provided and not empty
    if (role !== undefined && role !== "") {
      updateData.role = role;
    }

    // Only update status if it's provided and not empty
    if (status !== undefined && status !== "") {
      updateData.status = status;
    }

    // Only update is_active if it's explicitly provided (boolean)
    if (is_active !== undefined && typeof is_active === "boolean") {
      updateData.is_active = is_active;
    }

    if (sms_auto_send_enabled !== undefined && (sms_auto_send_enabled === null || typeof sms_auto_send_enabled === "boolean")) {
      updateData.sms_auto_send_enabled = sms_auto_send_enabled;
    }

    // Only update upline_id if it's provided
    if (upline_id !== undefined) {
      updateData.upline_id = upline_id === "all" || upline_id === ""
        ? null
        : upline_id;
    }

    // If no fields to update, return early
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, {
        status: 400,
      });
    }

    const updateQuery = supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", agentId);

    if (currentUser.agency_id) {
      updateQuery.eq("agency_id", currentUser.agency_id);
    }

    const { data: updatedAgent, error: updateError } = await updateQuery
      .select()
      .single();

    if (updateError) {
      console.error("Agent update error:", updateError, "updateData:", updateData);

      // Handle duplicate key constraint (e.g., email already in use)
      if (updateError.code === '23505') {
        let message = 'A record with this value already exists.'
        if (updateError.message?.includes('email')) {
          message = 'An agent with this email address already exists.'
        } else if (updateError.message?.includes('phone')) {
          message = 'An agent with this phone number already exists.'
        }
        return NextResponse.json({ error: message, detail: updateError.message }, { status: 409 });
      }

      return NextResponse.json({
        error: "Failed to update agent",
        detail: updateError.message,
      }, { status: 500 });
    }

    if (!updatedAgent) {
      return NextResponse.json({
        error: "Agent not found",
        detail: "No agent found with the provided ID",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Agent updated successfully",
    });
  } catch (error) {
    console.error("API Error in agent update:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while updating agent",
    }, { status: 500 });
  }
}
