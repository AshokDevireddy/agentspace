import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'
import { executeNIPRAutomation, type NIPRJobData } from '@/lib/nipr/automation'
import { updateUserNIPRData } from '@/lib/supabase-helpers'

export const maxDuration = 300 // 5 minutes timeout

/**
 * Process pending NIPR jobs from the queue
 * This endpoint can be called by:
 * 1. Vercel Cron (recommended for production)
 * 2. Manual trigger for testing
 * 3. After a job completes to process the next one
 */
export async function POST(request: NextRequest) {
  // Declare at function scope for access in catch block
  let acquiredJob: { job_id: string; job_user_id: string; job_last_name: string; job_npn: string; job_ssn_last4: string; job_dob: string } | null = null
  const supabaseAdmin = createAdminClient()

  try {
    // Verify cron secret or admin authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow if cron secret matches or if called internally
    const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`
    const isInternal = request.headers.get('x-internal-call') === 'true'

    if (!isAuthorized && !isInternal) {
      // For now, allow any call - in production you'd want stricter auth
      console.log('[API/NIPR/PROCESS] Processing without strict auth check')
    }

    // Release any stale locks first
    const { data: releasedCount } = await supabaseAdmin.rpc('release_stale_nipr_locks')
    if (releasedCount && releasedCount > 0) {
      console.log(`[API/NIPR/PROCESS] Released ${releasedCount} stale locks`)
    }

    // Try to acquire a pending job
    const { data: acquiredJobs, error: acquireError } = await supabaseAdmin.rpc('acquire_nipr_job')

    if (acquireError) {
      console.error('[API/NIPR/PROCESS] Failed to acquire job:', acquireError)
      return NextResponse.json({
        success: false,
        error: 'Failed to acquire job from queue'
      }, { status: 500 })
    }

    if (!acquiredJobs || acquiredJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending jobs to process',
        processed: 0
      })
    }

    // Assign to function-scoped variable for catch block access
    const job = acquiredJobs[0]
    acquiredJob = job
    console.log(`[API/NIPR/PROCESS] Processing job: ${job.job_id}`)

    // Build job data for automation
    const jobData: NIPRJobData = {
      job_id: job.job_id,
      job_user_id: job.job_user_id,
      job_last_name: job.job_last_name,
      job_npn: job.job_npn,
      job_ssn_last4: job.job_ssn_last4,
      job_dob: job.job_dob
    }

    // Capture job info for the background task
    const jobId = job.job_id
    const jobUserId = job.job_user_id

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
            console.log(`[API/NIPR/PROCESS] Saved ${result.analysis.unique_carriers.length} carriers and ${states.length} states to user ${jobUserId}`)
          } catch (dbError) {
            console.error('[API/NIPR/PROCESS] Failed to save NIPR data:', dbError)
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
        console.error('[API/NIPR/PROCESS] Background automation failed:', error)
        // Mark job as failed
        try {
          await adminClient.rpc('complete_nipr_job', {
            p_job_id: jobId,
            p_success: false,
            p_files: [],
            p_carriers: [],
            p_error: error instanceof Error ? error.message : String(error)
          })
          console.log(`[API/NIPR/PROCESS] Marked job ${jobId} as failed`)
        } catch (rpcError) {
          console.error('[API/NIPR/PROCESS] Failed to mark job as failed:', rpcError)
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
      message: `Processing job ${jobId}`,
      processed: 1
    })

  } catch (error) {
    console.error('[API/NIPR/PROCESS] Error:', error)

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
        console.log(`[API/NIPR/PROCESS] Marked job ${acquiredJob.job_id} as failed`)
      } catch (rpcError) {
        console.error('[API/NIPR/PROCESS] Failed to mark job as failed:', rpcError)
      }
    }

    // Still try to trigger next job so queue keeps moving
    triggerNextJobProcessing()

    return NextResponse.json({
      success: false,
      error: 'Job processing failed',
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
      console.log('[API/NIPR/PROCESS] No base URL configured, cron will pick up next job')
      return
    }

    const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    console.log('[API/NIPR/PROCESS] Triggering next job processing...')

    // Fire-and-forget: Don't await the response
    fetch(`${url}/api/nipr/process`, {
      method: 'POST',
      headers: {
        'x-internal-call': 'true'
      }
    }).catch(err => {
      console.log('[API/NIPR/PROCESS] Failed to trigger next job, cron will pick it up:', err)
    })
  } catch (err) {
    console.log('[API/NIPR/PROCESS] Failed to trigger next job, cron will pick it up:', err)
  }
}

/**
 * GET endpoint to check queue status
 */
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient()

    const { data: stats } = await supabaseAdmin
      .from('nipr_jobs')
      .select('status')

    if (!stats) {
      return NextResponse.json({ pending: 0, processing: 0, completed: 0, failed: 0 })
    }

    const counts = {
      pending: stats.filter(j => j.status === 'pending').length,
      processing: stats.filter(j => j.status === 'processing').length,
      completed: stats.filter(j => j.status === 'completed').length,
      failed: stats.filter(j => j.status === 'failed').length
    }

    return NextResponse.json(counts)
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get queue status'
    }, { status: 500 })
  }
}
