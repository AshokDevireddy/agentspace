import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getBackendUrl } from "@/lib/api-config";

export async function POST(req: NextRequest) {
  try {
    const { dealId } = await req.json();

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Get the authenticated user's session for the auth token
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call Django API endpoint
    const djangoUrl = `${getBackendUrl()}/api/sms/conversations/start`;
    const response = await fetch(djangoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ dealId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data.error || "Failed to start conversation",
          existingConversation: data.existingConversation,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      conversation: data.conversation,
      message: data.message || "Conversation started and welcome message sent"
    });

  } catch (err: unknown) {
    console.error('Error in start conversation API:', err);
    const message = err instanceof Error ? err.message : "Failed to start conversation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
