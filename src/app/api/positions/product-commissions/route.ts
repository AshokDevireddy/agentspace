// API ROUTE: /api/positions/product-commissions
// This endpoint manages position-product commission mappings
// GET: Fetches all commission mappings for the user's agency
// POST: Creates or updates commission mappings (batch operation)

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

    // Get the user's agency_id and id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("id, agency_id")
      .eq("auth_user_id", user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json({
        error: "User not found",
        detail: "Failed to fetch user information",
      }, { status: 404 });
    }

    const { id: userId } = userData;

    // Get carrier_id from URL search params (optional filter)
    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get("carrier_id");

    // Use RPC function to get commission mappings
    const { data: commissions, error: fetchError } = await supabase
      .rpc("get_position_product_commissions", {
        p_user_id: userId,
        p_carrier_id: carrierId || null,
      });

    if (fetchError) {
      console.error("Commissions fetch error:", fetchError);
      return NextResponse.json({
        error: "Failed to fetch commissions",
        detail: "Database query encountered an error",
      }, { status: 500 });
    }

    console.log("[Commission Fetch] RPC function returned:", {
      count: commissions?.length || 0,
      sample: commissions?.[0]
        ? {
          commission_id: commissions[0].commission_id,
          position_id: commissions[0].position_id,
          position_id_length: commissions[0].position_id?.length,
          product_id: commissions[0].product_id,
          product_id_length: commissions[0].product_id?.length,
        }
        : null,
      allPositionIds: commissions?.map((c: any) => ({
        id: c.position_id,
        length: c.position_id?.length,
      })) || [],
      allProductIds: commissions?.map((c: any) => ({
        id: c.product_id,
        length: c.product_id?.length,
      })) || [],
    });

    return NextResponse.json(commissions || []);
  } catch (error) {
    console.error("API Error in commissions:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while fetching commissions",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { commissions } = body;

    // Validate required fields
    if (!Array.isArray(commissions) || commissions.length === 0) {
      return NextResponse.json({
        error: "Missing required fields",
        detail: "commissions array is required",
      }, { status: 400 });
    }

    // Validate each commission entry
    for (const commission of commissions) {
      const { position_id, product_id, commission_percentage } = commission;

      if (
        !position_id || !product_id || commission_percentage === undefined ||
        commission_percentage === null
      ) {
        return NextResponse.json({
          error: "Invalid commission data",
          detail:
            "Each commission must have position_id, product_id, and commission_percentage",
        }, { status: 400 });
      }

      // Validate commission_percentage range
      if (commission_percentage < 0 || commission_percentage > 999.99) {
        return NextResponse.json({
          error: "Invalid commission percentage",
          detail: "commission_percentage must be between 0 and 999.99",
        }, { status: 400 });
      }
    }

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

    // Get the user's agency_id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("agency_id")
      .eq("auth_user_id", user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json({
        error: "User not found",
        detail: "Failed to fetch user information",
      }, { status: 404 });
    }

    const agencyId = userData.agency_id;

    if (!agencyId) {
      return NextResponse.json({
        error: "User not associated with an agency",
        detail: "User must be associated with an agency to create commissions",
      }, { status: 403 });
    }

    // Log incoming data for debugging
    const positionIds = [
      ...new Set(commissions.map((c: any) => c.position_id)),
    ];
    const productIds = [...new Set(commissions.map((c: any) => c.product_id))];

    console.log("[Commission Save] Agency ID:", agencyId);
    console.log(
      "[Commission Save] Incoming commissions:",
      JSON.stringify(commissions, null, 2),
    );
    console.log(
      "[Commission Save] Unique position IDs:",
      positionIds,
    );
    console.log(
      "[Commission Save] Unique product IDs:",
      productIds,
    );

    // Use upsert to create or update commission mappings
    const commissionsToInsert = commissions.map((c: any) => ({
      position_id: c.position_id,
      product_id: c.product_id,
      commission_percentage: c.commission_percentage,
    }));

    const { data: result, error } = await supabase
      .from("position_product_commissions")
      .upsert(commissionsToInsert, {
        onConflict: "position_id,product_id",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("Commission creation error:", error);
      return NextResponse.json({
        error: "Failed to create/update commissions",
        detail: "Database insert encountered an error",
      }, { status: 500 });
    }

    return NextResponse.json({ commissions: result }, { status: 201 });
  } catch (error) {
    console.error("API Error in commission creation:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      detail: "An unexpected error occurred while creating commissions",
    }, { status: 500 });
  }
}
