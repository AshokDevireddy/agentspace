// API ROUTE: /api/users/[id]
// Fetches user details by user ID with authentication

import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (required in Next.js 15+)
    const { id } = await params;

    // Create server client with auth
    const supabase = await createServerClient();

    // Verify authentication
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the requested user
    const { data: user, error } = await supabase
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
