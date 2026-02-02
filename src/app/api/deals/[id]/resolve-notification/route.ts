/**
 * Resolve Notification API Route
 * Proxies to Django to handle resolving notified statuses (lapse_notified, needs_more_info_notified)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/session';
import { getApiBaseUrl } from '@/lib/api-config';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the access token from the session
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: dealId } = await params;

    // Proxy to Django
    const djangoUrl = `${getApiBaseUrl()}/api/deals/${dealId}/resolve-notification`;

    const djangoResponse = await fetch(djangoUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await djangoResponse.json();

    if (!djangoResponse.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to resolve notification' },
        { status: djangoResponse.status }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Resolve notification error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to resolve notification'
      },
      { status: 500 }
    );
  }
}
