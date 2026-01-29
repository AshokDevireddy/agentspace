import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getApiBaseUrl } from '@/lib/api-config'
import { executeNIPRAutomation, type NIPRJobData } from '@/lib/nipr/automation'

export const maxDuration = 300 // 5 minutes timeout

/**
 * Helper to call Django NIPR API
 */
async function callNiprApi(endpoint: string, method: string = 'POST', body?: unknown) {
  const apiUrl = getApiBaseUrl()
  const response = await fetch(`${apiUrl}/api/nipr/${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': process.env.CRON_SECRET || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return response
}

/**
 * Helper to update user NIPR data via Django API
 */
async function updateUserNIPRDataViaDjango(
  userId: string,
  carriers: string[],
  states: string[]
): Promise<boolean> {
  const apiUrl = getApiBaseUrl()
  try {
    const response = await fetch(`${apiUrl}/api/user/${userId}/nipr-data`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({
        unique_carriers: carriers,
        licensed_states: states,
      }),
    })
    return response.ok
  } catch (error) {
    console.error(`Failed to update user ${userId} NIPR data:`, error)
    return false
  }
}

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

    // Release any stale locks first via Django
    const releaseResponse = await callNiprApi('release-locks', 'POST')
    if (releaseResponse.ok) {
      const releaseData = await releaseResponse.json()
      if (releaseData.count && releaseData.count > 0) {
        console.log(`[API/NIPR/PROCESS] Released ${releaseData.count} stale locks`)
      }
    }

    // Try to acquire a pending job via Django
    const acquireResponse = await callNiprApi('acquire-job', 'POST')
    const acquireData = await acquireResponse.json()
    const acquiredJobs = acquireData.acquired ? [acquireData.job] : []
    const acquireError = acquireResponse.ok ? null : new Error(acquireData.error || 'Failed to acquire job')

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
    acquiredJob = acquiredJobs[0]

    // Null check for type safety
    if (!acquiredJob) {
      return NextResponse.json({
        success: true,
        message: 'No pending jobs to process',
        processed: 0
      })
    }

    console.log(`[API/NIPR/PROCESS] Processing job: ${acquiredJob.job_id}`)

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
      try {
        const result = await executeNIPRAutomation(jobData)

        // Update job with results via Django
        await callNiprApi('complete-job', 'POST', {
          job_id: jobId,
          success: result.success,
          files: result.files || [],
          carriers: result.analysis?.unique_carriers || [],
          error: result.error || null,
        })

        // Save carriers and states to user if successful via Django API
        if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0 && jobUserId) {
          try {
            const states = result.analysis.licensed_states || []
            const updated = await updateUserNIPRDataViaDjango(jobUserId, result.analysis.unique_carriers, states)
            if (updated) {
              console.log(`[API/NIPR/PROCESS] Saved ${result.analysis.unique_carriers.length} carriers and ${states.length} states to user ${jobUserId}`)
            } else {
              console.error('[API/NIPR/PROCESS] Failed to save NIPR data via Django API')
            }
          } catch (dbError) {
            console.error('[API/NIPR/PROCESS] Failed to save NIPR data:', dbError)
          }
        }

        // Check if there are more pending jobs and trigger next via Django API
        try {
          const hasPendingResponse = await callNiprApi('has-pending', 'GET')
          if (hasPendingResponse.ok) {
            const hasPendingData = await hasPendingResponse.json()
            if (hasPendingData.has_pending) {
              triggerNextJobProcessing()
            }
          }
        } catch {
          // API call failed, cron will pick up next job
          console.log('[API/NIPR/PROCESS] Could not check for pending jobs')
        }
      } catch (error) {
        console.error('[API/NIPR/PROCESS] Background automation failed:', error)
        // Mark job as failed via Django
        try {
          await callNiprApi('complete-job', 'POST', {
            job_id: jobId,
            success: false,
            files: [],
            carriers: [],
            error: error instanceof Error ? error.message : String(error),
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
      message: `Processing job ${acquiredJob.job_id}`,
      processed: 1
    })

  } catch (error) {
    console.error('[API/NIPR/PROCESS] Error:', error)

    // If we acquired a job but failed, mark it as failed via Django
    if (acquiredJob) {
      try {
        await callNiprApi('complete-job', 'POST', {
          job_id: acquiredJob.job_id,
          success: false,
          files: [],
          carriers: [],
          error: error instanceof Error ? error.message : String(error),
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
 * GET endpoint to check queue status via Django API
 */
export async function GET() {
  try {
    // Use Django endpoint to get queue stats
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/onboarding/nipr/status`, {
      headers: {
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    }

    return NextResponse.json({ pending: 0, processing: 0, completed: 0, failed: 0 })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get queue status'
    }, { status: 500 })
  }
}
