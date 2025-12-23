import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'
import { executeNIPRAutomation, type NIPRJobData } from '@/lib/nipr/automation'
import { updateUserNIPRData } from '@/lib/supabase-helpers'

export const maxDuration = 300 // 5 minutes timeout

/**
 * Cron job to process pending NIPR jobs
 * Runs every 5 minutes via Vercel Cron
 */
export async function GET(request: NextRequest) {
  // Declare at function scope for access in catch block
  let acquiredJob: { job_id: string; job_user_id: string; job_last_name: string; job_npn: string; job_ssn_last4: string; job_dob: string } | null = null
  const supabaseAdmin = createAdminClient()

  try {
    // Verify cron secret in production
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

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

    // Assign to function-scoped variable for catch block access
    acquiredJob = acquiredJobs[0]
    console.log(`[CRON/NIPR] Processing job: ${acquiredJob.job_id}`)

    // Build job data for automation
    const jobData: NIPRJobData = {
      job_id: acquiredJob.job_id,
      job_user_id: acquiredJob.job_user_id,
      job_last_name: acquiredJob.job_last_name,
      job_npn: acquiredJob.job_npn,
      job_ssn_last4: acquiredJob.job_ssn_last4,
      job_dob: acquiredJob.job_dob
    }

    // Capture job info for the background task
    const jobId = acquiredJob.job_id
    const jobUserId = acquiredJob.job_user_id

    // Run automation in background with waitUntil to keep function alive
    const automationPromise = (async () => {
      const adminClient = createAdminClient()

      try {
        const result = await executeNIPRAutomation(jobData)

        // Update job with results
        await adminClient.rpc('complete_nipr_job', {
          p_job_id: jobId,
          p_success: result.success,
          p_files: result.files || [],
          p_carriers: result.analysis?.unique_carriers || [],
          p_error: result.error || null
        })

        // Save carriers and states to user if successful
        if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0 && jobUserId) {
          try {
            const states = result.analysis.licensed_states || []
            await updateUserNIPRData(adminClient, jobUserId, result.analysis.unique_carriers, states)
            console.log(`[CRON/NIPR] Saved ${result.analysis.unique_carriers.length} carriers and ${states.length} states to user ${jobUserId}`)
          } catch (dbError) {
            console.error('[CRON/NIPR] Failed to save NIPR data:', dbError)
          }
        }

        // Check if there are more pending jobs and trigger next
        const { data: pendingJobs } = await adminClient
          .from('nipr_jobs')
          .select('id')
          .eq('status', 'pending')
          .limit(1)

        if (pendingJobs && pendingJobs.length > 0) {
          triggerNextJobProcessing()
        }
      } catch (error) {
        console.error('[CRON/NIPR] Background automation failed:', error)
        // Mark job as failed
        try {
          await adminClient.rpc('complete_nipr_job', {
            p_job_id: jobId,
            p_success: false,
            p_files: [],
            p_carriers: [],
            p_error: error instanceof Error ? error.message : String(error)
          })
          console.log(`[CRON/NIPR] Marked job ${jobId} as failed`)
        } catch (rpcError) {
          console.error('[CRON/NIPR] Failed to mark job as failed:', rpcError)
        }
        // Still try to trigger next job
        triggerNextJobProcessing()
      }
    })()

    // Keep serverless function alive until automation completes
    waitUntil(automationPromise)

    // Return immediately - function stays alive via waitUntil
    return NextResponse.json({
      success: true,
      message: `Processing job ${acquiredJob.job_id}`,
      processed: 1
    })

  } catch (error) {
    console.error('[CRON/NIPR] Error:', error)

    // If we acquired a job but failed, mark it as failed
    if (acquiredJob) {
      try {
        await supabaseAdmin.rpc('complete_nipr_job', {
          p_job_id: acquiredJob.job_id,
          p_success: false,
          p_files: [],
          p_carriers: [],
          p_error: error instanceof Error ? error.message : String(error)
        })
        console.log(`[CRON/NIPR] Marked job ${acquiredJob.job_id} as failed`)
      } catch (rpcError) {
        console.error('[CRON/NIPR] Failed to mark job as failed:', rpcError)
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

/**
 * Trigger processing of the next pending job in a new serverless function
 * Fire-and-forget to ensure each job gets fresh timeout
 */
function triggerNextJobProcessing(): void {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    if (!baseUrl) {
      console.log('[CRON/NIPR] No base URL configured, cron will pick up next job')
      return
    }

    const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    console.log('[CRON/NIPR] Triggering next job processing...')

    // Fire-and-forget: Don't await the response
    fetch(`${url}/api/nipr/process`, {
      method: 'POST',
      headers: {
        'x-internal-call': 'true'
      }
    }).catch(err => {
      console.log('[CRON/NIPR] Failed to trigger next job, cron will pick it up:', err)
    })
  } catch (err) {
    console.log('[CRON/NIPR] Failed to trigger next job, cron will pick it up:', err)
  }
}
