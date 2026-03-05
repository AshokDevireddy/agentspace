import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { buildBookFilters } from "../_shared";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser, error: currentUserError } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error("Error fetching current user:", currentUserError);
      return NextResponse.json({ error: "Failed to resolve current user" }, {
        status: 500,
      });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "downlines";
    const filters = buildBookFilters(searchParams);

    const { data, error: rpcError } = await admin.rpc(
      "get_book_of_business_summary",
      {
        p_user_id: currentUser.id,
        p_filters: filters,
        p_view: view,
      },
    );

    if (rpcError) {
      console.error("get_book_of_business_summary RPC error:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const row = data?.[0] || {
      total_annual_premium: 0,
      total_face_value: 0,
      total_policies: 0,
    };

    return NextResponse.json({
      totalAnnualPremium: Number(row.total_annual_premium),
      totalCoverageAmount: Number(row.total_face_value),
      totalPolicies: Number(row.total_policies),
    }, { status: 200 });
  } catch (err: any) {
    console.error("Error in book-of-business summary API:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch summary" },
      { status: 500 },
    );
  }
}
