import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { executeNIPRAutomation, type NIPRJobData } from '@/lib/nipr/automation'
import { updateUserCarriers } from '@/lib/supabase-helpers'

export const maxDuration = 300 // 5 minutes timeout

/**
 * Cron job to process pending NIPR jobs
 * Runs every 5 minutes via Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabaseAdmin = createAdminClient()

    // Release any stale locks first
    try {
      const { data: releasedCount } = await supabaseAdmin.rpc('release_stale_nipr_locks')
      if (releasedCount && releasedCount > 0) {
        console.log(`[CRON/NIPR] Released ${releasedCount} stale locks`)
      }
    } catch (err) {
      // Table might not exist yet
      console.log('[CRON/NIPR] Could not release stale locks (table may not exist)')
    }

    // Try to acquire a pending job
    let acquiredJobs = null
    try {
      const { data, error } = await supabaseAdmin.rpc('acquire_nipr_job')
      if (error) throw error
      acquiredJobs = data
    } catch (err) {
      // Table might not exist yet
      console.log('[CRON/NIPR] Could not acquire job (table may not exist)')
      return NextResponse.json({
        success: true,
        message: 'Queue not configured',
        processed: 0
      })
    }

    if (!acquiredJobs || acquiredJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending jobs',
        processed: 0
      })
    }

    const job = acquiredJobs[0]
    console.log(`[CRON/NIPR] Processing job: ${job.job_id}`)

    // Execute the automation
    const jobData: NIPRJobData = {
      job_id: job.job_id,
      job_user_id: job.job_user_id,
      job_last_name: job.job_last_name,
      job_npn: job.job_npn,
      job_ssn_last4: job.job_ssn_last4,
      job_dob: job.job_dob
    }

    const result = await executeNIPRAutomation(jobData)

    // Update job with results
    await supabaseAdmin.rpc('complete_nipr_job', {
      p_job_id: job.job_id,
      p_success: result.success,
      p_files: result.files || [],
      p_carriers: result.analysis?.unique_carriers || [],
      p_error: result.error || null
    })

    // Save carriers to user if successful
    if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0 && job.job_user_id) {
      try {
        await updateUserCarriers(job.job_user_id, result.analysis.unique_carriers)
        console.log(`[CRON/NIPR] Saved ${result.analysis.unique_carriers.length} carriers to user ${job.job_user_id}`)
      } catch (dbError) {
        console.error('[CRON/NIPR] Failed to save carriers:', dbError)
      }
    }

    // Check for more pending jobs
    const { data: pendingJobs } = await supabaseAdmin
      .from('nipr_jobs')
      .select('id')
      .eq('status', 'pending')
      .limit(1)

    return NextResponse.json({
      success: true,
      message: `Processed job ${job.job_id}`,
      processed: 1,
      jobSuccess: result.success,
      hasMoreJobs: pendingJobs && pendingJobs.length > 0
    })

  } catch (error) {
    console.error('[CRON/NIPR] Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
