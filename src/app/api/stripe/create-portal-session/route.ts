import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/session';
import { getBackendUrl } from '@/lib/api-config';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    // Get access token from Django session
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user Stripe data from Django
    const djangoUrl = `${getBackendUrl()}/api/user/stripe-profile`;
    const userResponse = await fetch(djangoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get user data' },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();

    if (!userData.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    // Create portal session
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: `${origin}/user/profile`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: unknown) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
