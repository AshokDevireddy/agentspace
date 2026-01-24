import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    const { data: { user } } = await server.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser, error: currentUserError } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const searchTerm = searchParams.get("q") || "";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100,
    );

    const { data, error } = await admin.rpc("search_agents_for_filter", {
      p_user_id: currentUser.id,
      p_search_term: searchTerm,
      p_limit: limit,
    });

    if (error) {
      console.error("search_agents_for_filter error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the response to format agent names for the filter dropdown
    // Format: "Last, First" when both exist, just the single name if only one exists, "Unknown Agent" if both missing
    const formattedData = (data || []).map((item: any) => {
      let firstName = "";
      let lastName = "";
      let value = "";

      // Check if RPC returns { value, label } format with first_name/last_name fields
      if (
        item.value &&
        (item.first_name !== undefined || item.last_name !== undefined)
      ) {
        firstName = (item.first_name || "").trim();
        lastName = (item.last_name || "").trim();
        value = item.value;
      } // Check if RPC returns raw agent data with id, first_name, last_name
      else if (
        item.id &&
        (item.first_name !== undefined || item.last_name !== undefined)
      ) {
        firstName = (item.first_name || "").trim();
        lastName = (item.last_name || "").trim();
        value = item.id;
      } // If it already has a label but we can't extract names, return as-is
      else if (item.value && item.label) {
        return item;
      } // Fallback: return as-is if we can't determine the format
      else {
        return item;
      }

      // Format the label based on what names are available
      let label = "";
      if (firstName && lastName) {
        // Both names: "Last, First"
        label = `${lastName}, ${firstName}`;
      } else if (firstName) {
        // Only first name: just "First" (no spaces or commas)
        label = firstName;
      } else if (lastName) {
        // Only last name: just "Last" (no spaces or commas)
        label = lastName;
      } else {
        // Neither: "Unknown Agent" (space, no comma)
        label = "Unknown Agent";
      }

      return { value, label };
    });

    return NextResponse.json(formattedData);
  } catch (err: any) {
    console.error("Error in search-agents API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
