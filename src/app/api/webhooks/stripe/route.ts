import { NextRequest, NextResponse } from 'next/server';

/**
 * Stripe Webhook Proxy
 *
 * This endpoint receives Stripe webhooks and forwards them to the Django backend.
 * The Django backend handles all webhook processing logic.
 */

// Disable body parsing for this route to get raw body for Stripe signature verification
export const runtime = 'nodejs';

// CRITICAL: This tells Next.js not to parse the body automatically
// Without this, Stripe signature verification will fail
export const dynamic = 'force-dynamic';

const DJANGO_API_URL = process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body - must preserve exact bytes for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    // Forward the webhook to Django backend
    const response = await fetch(`${DJANGO_API_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      body: rawBody,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Django webhook error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error forwarding webhook to Django:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
