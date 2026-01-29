/**
 * Needs More Info Notifications Cron Job
 * Runs periodically to update needs_more_info status to needs_more_info_notified
 * This doesn't send messages, just marks deals for agent notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-config';
import { verifyCronRequest } from '@/lib/cron-auth';

/**
 * Helper to update deal status via Django API
 */
async function updateDealStatus(dealId: string, statusStandardized: string): Promise<boolean> {
  const apiUrl = getApiBaseUrl();
  try {
    const response = await fetch(`${apiUrl}/api/deals/${dealId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({ status_standardized: statusStandardized }),
    });
    return response.ok;
  } catch (error) {
    console.error(`Failed to update deal ${dealId} status:`, error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {

    // Verify this is a cron request
    const authResult = verifyCronRequest(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Query deals using Django API
    console.log('🔍 Querying deals using Django API...');
    const apiUrl = getApiBaseUrl();
    const response = await fetch(`${apiUrl}/api/messaging/needs-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error querying deals:', errorData);
      throw new Error(errorData.error || 'Failed to fetch needs info deals');
    }

    const responseData = await response.json();
    const deals = responseData.deals || [];

    if (!deals || deals.length === 0) {
      console.log('No deals eligible for needs more info notifications found');
      return NextResponse.json({
        success: true,
        updated: 0,
        message: 'No deals eligible for needs more info notifications',
      });
    }

    console.log(`Found ${deals.length} deals eligible for needs more info notifications`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Update status to needs_more_info_notified (only for Pro/Expert with messaging enabled)
    console.log('\n📋 Processing needs more info notifications...');
    for (const deal of deals) {
      try {
        console.log(`\n📋 Processing deal ${deal.deal_id} (${deal.client_name})`);
        console.log(`  Messaging Enabled: ${deal.messaging_enabled}`);

        // Check if messaging is disabled for agency (RPC already filters, but double-check)
        if (!deal.messaging_enabled) {
          console.log(`  ⏭️  SKIPPED: Messaging is disabled for agency ${deal.agency_name}`);
          console.log(`  ℹ️  Status remains unchanged (not updating to 'needs_more_info_notified')`);
          skippedCount++;
          continue;
        }

        // Check agent subscription tier - only Pro and Expert get status updates
        // For Free/Basic tiers, skip status update entirely
        if (deal.agent_subscription_tier === 'free' || deal.agent_subscription_tier === 'basic') {
          console.log(`  ⏭️  SKIPPED: Agent is on ${deal.agent_subscription_tier} tier (automated messaging restricted to Pro/Expert only)`);
          console.log(`  ℹ️  Status remains unchanged (not updating to 'needs_more_info_notified')`);
          skippedCount++;
          continue;
        }

        // Update status for Pro/Expert agents with messaging enabled via Django API
        const updated = await updateDealStatus(deal.deal_id, 'needs_more_info_notified');
        if (updated) {
          successCount++;
          console.log(`  ✅ Updated deal ${deal.deal_id} to 'needs_more_info_notified'`);
        } else {
          console.error(`  ❌ Failed to update deal ${deal.deal_id}`);
          errorCount++;
        }

      } catch (error) {
        console.error(`  ❌ Failed to update deal ${deal.deal_id}:`, error);
        errorCount++;
      }
    }

    console.log('\nℹ️  ========================================');
    console.log('ℹ️  NEEDS MORE INFO NOTIFICATIONS COMPLETED');
    console.log('ℹ️  ========================================');
    console.log(`✅ Updated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📊 Total: ${deals.length}`);
    console.log('ℹ️  ========================================\n');

    return NextResponse.json({
      success: true,
      updated: successCount,
      failed: errorCount,
      skipped: skippedCount,
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

