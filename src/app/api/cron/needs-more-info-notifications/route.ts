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
    // Join with users to get agent subscription tier and agencies to check messaging_enabled
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        id,
        client_name,
        agent_id,
        agency_id,
        users!deals_agent_id_fkey(
          id,
          first_name,
          last_name,
          subscription_tier
        ),
        agencies!deals_agency_id_fkey(
          id,
          name,
          messaging_enabled
        )
      `)
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
    let skippedCount = 0;

    // Update status to needs_more_info_notified (only for Pro/Expert with messaging enabled)
    for (const deal of deals) {
      try {
        const agent = Array.isArray(deal.users) ? deal.users[0] : deal.users;
        const agency = Array.isArray(deal.agencies) ? deal.agencies[0] : deal.agencies;
        const agentTier = agent?.subscription_tier || 'free';
        const messagingEnabled = agency?.messaging_enabled || false;

        console.log(`\n📋 Processing deal ${deal.id} (${deal.client_name})`);
        console.log(`  Agent: ${agent?.first_name} ${agent?.last_name}`);
        console.log(`  Agent Tier: ${agentTier}`);
        console.log(`  Agency: ${agency?.name}`);
        console.log(`  Messaging Enabled: ${messagingEnabled}`);

        // Check if messaging is disabled for agency
        if (!messagingEnabled) {
          console.log(`  ⏭️  SKIPPED: Messaging is disabled for agency ${agency?.name}`);
          console.log(`  ℹ️  Status remains as 'needs_more_info' (not updating to 'needs_more_info_notified')`);
          skippedCount++;
          continue;
        }

        // Check agent subscription tier - only Pro and Expert get status updates
        // For Free/Basic tiers, skip status update entirely
        if (agentTier === 'free' || agentTier === 'basic') {
          console.log(`  ⏭️  SKIPPED: Agent is on ${agentTier} tier (automated messaging restricted to Pro/Expert only)`);
          console.log(`  ℹ️  Status remains as 'needs_more_info' (not updating to 'needs_more_info_notified')`);
          skippedCount++;
          continue;
        }

        // Update status for Pro/Expert agents with messaging enabled
        await supabase
          .from('deals')
          .update({ status_standardized: 'needs_more_info_notified' })
          .eq('id', deal.id);

        successCount++;
        console.log(`  ✅ Updated deal ${deal.id} to 'needs_more_info_notified'`);

      } catch (error) {
        console.error(`  ❌ Failed to update deal ${deal.id}:`, error);
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

