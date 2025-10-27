/**
 * Needs More Info Notifications Cron Job
 * Runs periodically to update needs_more_info status to needs_more_info_notified
 * This doesn't send messages, just marks deals for agent notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.CRON_SECRET) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const supabase = createAdminClient();

    console.log('Running needs_more_info notifications cron');

    // Query deals with status_standardized = 'needs_more_info' (not yet notified)
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('id, client_name')
      .eq('status_standardized', 'needs_more_info');

    if (dealsError) {
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log('No deals with needs_more_info status found');
      return NextResponse.json({
        success: true,
        updated: 0,
        message: 'No deals requiring notification',
      });
    }

    console.log(`Found ${deals.length} deals that need more info`);

    let successCount = 0;
    let errorCount = 0;

    // Update status to needs_more_info_notified
    for (const deal of deals) {
      try {
        await supabase
          .from('deals')
          .update({ status_standardized: 'needs_more_info_notified' })
          .eq('id', deal.id);

        successCount++;
        console.log(`Notified deal ${deal.id} (${deal.client_name})`);

      } catch (error) {
        console.error(`Failed to update deal ${deal.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updated: successCount,
      failed: errorCount,
      total: deals.length,
    });

  } catch (error) {
    console.error('Needs more info notifications cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

