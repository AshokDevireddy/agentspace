/**
 * Resolve Notification API Route
 * Handles resolving notified statuses (lapse_notified, needs_more_info_notified)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: dealId } = await params;

    // Get the deal to check current status
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, status_standardized')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    // Only allow resolving notified statuses
    if (deal.status_standardized !== 'lapse_notified' &&
        deal.status_standardized !== 'needs_more_info_notified') {
      return NextResponse.json(
        { error: 'Deal does not have a notified status to resolve' },
        { status: 400 }
      );
    }

    // Update status_standardized to NULL to resolve the notification
    const { error: updateError } = await supabase
      .from('deals')
      .update({ status_standardized: null })
      .eq('id', dealId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Notification resolved successfully',
    });

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

