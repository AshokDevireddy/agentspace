/**
 * Search Deals for Conversation Creation API Route
 * Searches deals by client name or phone number for starting new conversations
 * Uses same hierarchy as book of business (respects agent hierarchy)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    // Identify current user
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Map auth user to `users` row
    const { data: currentUser, error: currentUserError } = await admin
      .from("users")
      .select("id, agency_id, perm_level, role")
      .eq("auth_user_id", user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error("Error fetching current user:", currentUserError);
      return NextResponse.json({ error: "Failed to resolve current user" }, {
        status: 500,
      });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const clientName = searchParams.get("client_name");
    const clientPhone = searchParams.get("client_phone");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    // At least one search parameter must be provided
    if (!clientName && !clientPhone) {
      return NextResponse.json({
        error: "Must provide client_name or client_phone",
      }, { status: 400 });
    }

    // Build filters for RPC call
    const filters = {
      agent_id: null,
      carrier_id: null,
      product_id: null,
      client_id: null,
      policy_number: null,
      status: null,
      billing_cycle: null,
      lead_source: null,
      effective_date_start: null,
      effective_date_end: null,
      client_name: clientName || null,
      client_phone: clientPhone || null,
    };

    // Use the same RPC function as book of business for hierarchy enforcement
    const { data: deals, error: rpcError } = await admin.rpc(
      "get_book_of_business",
      {
        p_user_id: currentUser.id,
        p_filters: filters,
        p_limit: limit,
        p_cursor_id: null,
        p_cursor_created_at: null,
      },
    );

    if (rpcError) {
      console.error("get_book_of_business RPC error:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Transform deals for the search results
    const transformedDeals = (deals || []).map((deal: any) => ({
      id: deal.id,
      agentId: deal.agent_id,
      clientName: deal.client_name,
      clientPhone: deal.client_phone || "",
      carrier: deal.carrier_display_name || "Unknown Carrier",
      product: deal.product_name || "Unknown Product",
      policyNumber: deal.policy_number || "",
      status: deal.status || "draft",
      agent: deal.agent_last_name && deal.agent_first_name
        ? `${deal.agent_last_name.trim()}, ${deal.agent_first_name.trim()}`
        : deal.agent_first_name
        ? deal.agent_first_name.trim()
        : deal.agent_last_name
        ? deal.agent_last_name.trim()
        : "Unknown Agent",
    }));

    return NextResponse.json({ deals: transformedDeals }, { status: 200 });
  } catch (err: any) {
    console.error("Error in search-for-conversation API:", err);
    return NextResponse.json(
      { error: err.message || "Failed to search deals" },
      { status: 500 },
    );
  }
}
