/**
 * Lapse Reminders Cron Job
 * Thin trigger that calls Django endpoint to create lapse reminder drafts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-config';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  // Verify this is a cron request
  const authResult = verifyCronRequest(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    // Call Django endpoint to run the lapse reminders job
    const apiUrl = getApiBaseUrl();
    const response = await fetch(`${apiUrl}/api/messaging/run/lapse-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Lapse reminders job failed:', errorData);
      return NextResponse.json(
        { success: false, error: errorData.error || 'Failed to run lapse reminders' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Lapse reminders cron error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
