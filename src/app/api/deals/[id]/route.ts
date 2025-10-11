import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  try {
    const data = await req.json();
    const dealId = params.id;

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Add updated_at timestamp
    data.updated_at = new Date().toISOString();

    const { data: deal, error } = await supabase
      .from("deals")
      .update(data)
      .eq("id", dealId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ deal, message: "Deal updated successfully" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update deal" },
      { status: 500 }
    );
  }
} 