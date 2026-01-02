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
      name: `${agent.last_name}, ${agent.first_name}`,
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

    // Check if user is admin (check all admin indicators)
    const { data: currentUser } = await supabaseAdmin
      .from("users")
      .select("is_admin, perm_level, role")
      .eq("auth_user_id", user.id)
      .single();

    const isAdmin = currentUser?.is_admin || 
                   currentUser?.perm_level === "admin" || 
                   currentUser?.role === "admin";

    if (!currentUser || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, phone_number, role, status, upline_id } = body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (upline_id !== undefined) {
      updateData.upline_id = upline_id === "all" || upline_id === ""
        ? null
        : upline_id;
    }

    // Update agent
    const { data: updatedAgent, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", agentId)
      .select()
      .single();

    if (updateError) {
      console.error("Agent update error:", updateError);
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
