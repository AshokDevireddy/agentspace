// API ROUTE: /api/users/[id]
// Fetches user details by user ID with authentication and authorization

import { NextResponse } from "next/server";
import { authenticateRoute, authorizeAgentAccess, isAuthError } from "@/lib/auth/route-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate and authorize
    const authResult = await authenticateRoute();
    if (isAuthError(authResult)) return authResult;

    const accessResult = await authorizeAgentAccess(authResult.supabaseAdmin, authResult.user, id);
    if (accessResult !== true) return accessResult;

    // Fetch the requested user
    const { data: user, error } = await authResult.supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, phone_number, perm_level, upline_id, position_id, status')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch user", detail: error.message },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
