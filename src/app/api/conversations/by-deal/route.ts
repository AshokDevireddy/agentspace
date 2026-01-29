/**
 * Get Conversation by Deal API Route
 * Proxies to Django backend to find existing conversation for a deal.
 */

import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/api-proxy";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get('dealId');

    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Proxy to Django conversations find endpoint with deal_id filter
    return proxyToBackend(req, '/api/sms/conversations/find', {
      method: 'GET',
      searchParams: { deal_id: dealId },
    });

  } catch (err: unknown) {
    console.error('Error in by-deal conversation API:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}
