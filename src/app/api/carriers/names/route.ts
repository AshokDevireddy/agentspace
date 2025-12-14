// API ROUTE: /api/carriers/names
// This endpoint fetches all carrier names from the carriers table
// Used to populate carrier dropdown in the carrier logins configuration

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // Create admin Supabase client
        const adminClient = createAdminClient();

        // Fetch all active carriers from the carriers table, only the name column
        const { data: carriers, error: fetchError } = await adminClient
            .from("carriers")
            .select("name")
            .eq("is_active", true) // Only fetch active carriers
            .order("name", { ascending: true }); // Order by name

        if (fetchError) {
            console.error("Carriers fetch error:", fetchError);
            return NextResponse.json({
                error: "Failed to fetch carriers",
                detail: "Database query encountered an error",
            }, { status: 500 });
        }

        // Extract just the names from the results
        const carrierNames = (carriers || []).map((carrier) => carrier.name);

        return NextResponse.json(carrierNames);
    } catch (error) {
        console.error("API Error in carriers/names:", error);
        return NextResponse.json({
            error: "Internal Server Error",
            detail: "An unexpected error occurred while fetching carrier names",
        }, { status: 500 });
    }
}
