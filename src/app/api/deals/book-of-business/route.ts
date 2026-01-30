import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    // Identify current user and compute visible agent IDs (self + downline)
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

    // Check if user is admin
    // Get query parameters for filtering + pagination (keyset)
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agent_id");
    const carrierId = searchParams.get("carrier_id");
    const productId = searchParams.get("product_id");
    const clientId = searchParams.get("client_id");
    const policyNumber = searchParams.get("policy_number");
    const statusMode = searchParams.get("status_mode");
    const statusStandardized = searchParams.get("status_standardized");
    const effectiveDateSort = searchParams.get("effective_date_sort");
    const billingCycle = searchParams.get("billing_cycle");
    const leadSource = searchParams.get("lead_source");
    const effectiveDateStart = searchParams.get("effective_date_start");
    const effectiveDateEnd = searchParams.get("effective_date_end");
    const view = searchParams.get("view") || "downlines";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200,
    );
    const cursorCreatedAt = searchParams.get("cursor_created_at");
    const cursorId = searchParams.get("cursor_id");

    const filters = {
      agent_id: agentId && agentId !== "all" ? agentId : null,
      carrier_id: carrierId && carrierId !== "all" ? carrierId : null,
      product_id: productId && productId !== "all" ? productId : null,
      client_id: clientId && clientId !== "all" ? clientId : null,
      policy_number: policyNumber && policyNumber !== "all"
        ? policyNumber.trim()
        : null,
      status_mode: statusMode || null,
      status_standardized: statusStandardized && statusStandardized !== "all"
        ? statusStandardized
        : null,
      effective_date_sort: effectiveDateSort && effectiveDateSort !== "all"
        ? effectiveDateSort
        : null,
      billing_cycle: billingCycle && billingCycle !== "all"
        ? billingCycle
        : null,
      lead_source: leadSource && leadSource !== "all" ? leadSource : null,
      effective_date_start: effectiveDateStart || null,
      effective_date_end: effectiveDateEnd || null,
    };

    const { data: deals, error: rpcError } = await admin.rpc(
      "get_book_of_business",
      {
        p_user_id: currentUser.id,
        p_filters: filters,
        p_limit: limit,
        p_cursor_id: cursorId,
        p_cursor_created_at: cursorCreatedAt,
        p_view: view,
      },
    );

    if (rpcError) {
      console.error("get_book_of_business RPC error:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Check if user is admin
    const isAdmin = currentUser.perm_level === "admin" ||
      currentUser.role === "admin";

    // Sort deals by created_at timestamp (descending - newest first)
    // NOTE: This client-side sort ensures data is ordered by created_at.
    // For optimal performance, the database function should also ORDER BY created_at
    // to match the cursor pagination which uses created_at.
    const sortedDeals = [...(deals || [])].sort((a: any, b: any) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });

    const transformedDeals = sortedDeals.map((deal: any) => {
      // Determine if phone should be hidden
      // Hide if: view is 'downlines' AND user is not admin AND user is not the writing agent AND deal is active/pending
      const isWritingAgent = deal.agent_id === currentUser.id;
      const isActiveOrPending = deal.status_impact === "positive" ||
        deal.status_impact === "neutral";
      const shouldHidePhone = view === "downlines" && !isAdmin &&
        !isWritingAgent && isActiveOrPending;

      // Helper function to parse and format date safely
      const parseAndFormatDate = (
        dateValue: string | null | undefined,
      ): string => {
        if (!dateValue) return "N/A";

        // Fix timezone shift for YYYY-MM-DD dates by adding "T00:00:00"
        const safeDateString = dateValue.length === 10
          ? `${dateValue}T00:00:00`
          : dateValue;

        const date = new Date(safeDateString);
        if (isNaN(date.getTime())) return "N/A";

        const year = date.getFullYear();
        if (year < 2000) return "N/A";

        // Return in MM/DD/YYYY format
        return date.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric", // important: gives 4-digit year
        });
      };

      // Determine which date to use for the date column
      const effectiveDateObj = deal.policy_effective_date
        ? new Date(deal.policy_effective_date + "T00:00:00")
        : null;

      const effectiveDateYear =
        effectiveDateObj && !isNaN(effectiveDateObj.getTime())
          ? effectiveDateObj.getFullYear()
          : null;

      const useEffectiveDate = effectiveDateYear !== null &&
        effectiveDateYear >= 2000;

      const dateToUse = useEffectiveDate
        ? deal.policy_effective_date
        : deal.created_at;

      return {
        id: deal.id,
        carrierId: deal.carrier_id || "",
        date: parseAndFormatDate(dateToUse),
        agent: deal.agent_last_name && deal.agent_first_name
          ? `${deal.agent_first_name.trim()} ${deal.agent_last_name.trim()}`
          : deal.agent_first_name
          ? deal.agent_first_name.trim()
          : deal.agent_last_name
          ? deal.agent_last_name.trim()
          : "Unknown Agent",
        carrier: deal.carrier_display_name || "Unknown Carrier",
        product: deal.product_name || "Unknown Product",
        policyNumber: deal.policy_number || "",
        appNumber: deal.application_number || "",
        clientName: deal.client_name,
        clientPhone: shouldHidePhone ? "HIDDEN" : (deal.client_phone || ""),
        phoneHidden: shouldHidePhone,
        agentId: deal.agent_id,
        effectiveDate: parseAndFormatDate(deal.policy_effective_date),
        effectiveDateRaw: deal.policy_effective_date || "",
        annualPremium: `$${Number(deal.annual_premium || 0).toFixed(2)}`,
        annualPremiumRaw: Number(deal.annual_premium || 0),
        billingCycle: deal.billing_cycle || "",
        leadSource: deal.lead_source || "",
        status: deal.status || "draft",
        statusStandardized: deal.status_standardized || deal.status || "draft",
        ssnBenefit: deal.ssn_benefit || false,
        billingDayOfMonth: deal.billing_day_of_month || null,
        billingWeekday: deal.billing_weekday || null,
      };
    });

    // Calculate cursor from the sorted deals (last item after sorting by created_at)
    const last = sortedDeals[sortedDeals.length - 1];
    const nextCursor = last
      ? { cursor_created_at: last.created_at, cursor_id: last.id }
      : null;

    return NextResponse.json({ deals: transformedDeals, nextCursor }, {
      status: 200,
    });
  } catch (err: any) {
    console.error("Error in book-of-business API:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch deals" },
      { status: 500 },
    );
  }
}
