import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import type { NIPRInput } from '@/lib/nipr'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'
import { executeNIPRAutomation, type NIPRJobData } from '@/lib/nipr/automation'

export const maxDuration = 300 // 5 minutes timeout for long-running automation

/**
 * Helper to call Django NIPR API
 */
async function callNiprApi(endpoint: string, method: string = 'POST', body?: unknown, accessToken?: string) {
  const apiUrl = getApiBaseUrl()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  } else {
    headers['X-Cron-Secret'] = process.env.CRON_SECRET || ''
  }

  const response = await fetch(`${apiUrl}/api/nipr/${endpoint}`, {
    method,
    headers,
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

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session
    const session = await getSession()
    const accessToken = session?.accessToken

    // Get current user info from Django
    let currentUser: { id: string; is_admin?: boolean } | null = null
    if (accessToken) {
      const apiUrl = getApiBaseUrl()
      const userResponse = await fetch(`${apiUrl}/api/user/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (userResponse.ok) {
        const userData = await userResponse.json()
        currentUser = { id: userData.id, is_admin: userData.is_admin }
      }
    }

    // Check if NIPR has already been completed for this user (has carriers)
    if (currentUser?.id) {
      const checkResponse = await callNiprApi('check-completed', 'GET', undefined, accessToken || undefined)
      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        if (checkData.completed) {
          return NextResponse.json({
            success: false,
            error: 'NIPR verification has already been completed for your account',
            alreadyCompleted: true
          }, { status: 400 })
        }
      }
    }

    const body = await request.json()

    // Validate required fields
    const { lastName, npn, ssn, dob } = body as Partial<NIPRInput>

    if (!lastName || !npn || !ssn || !dob) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: lastName, npn, ssn, dob'
        },
        { status: 400 }
      )
    }

    // Validate SSN format (4 digits)
    if (!/^\d{4}$/.test(ssn)) {
      return NextResponse.json(
        {
          success: false,
          error: 'SSN must be exactly 4 digits'
        },
        { status: 400 }
      )
    }

    // Validate DOB format (MM/DD/YYYY)
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
      return NextResponse.json(
        {
          success: false,
          error: 'DOB must be in MM/DD/YYYY format'
        },
        { status: 400 }
      )
    }

    // Validate NPN (numeric)
    if (!/^\d+$/.test(npn)) {
      return NextResponse.json(
        {
          success: false,
          error: 'NPN must be numeric'
        },
        { status: 400 }
      )
    }

    // Always use queue mode if user is authenticated
    if (currentUser?.id) {
      // Create job as PENDING via Django API
      const createJobResponse = await callNiprApi('jobs', 'POST', {
        user_id: currentUser.id,
        last_name: lastName,
        npn: npn,
        ssn_last4: ssn,
        dob: dob,
      })

      if (!createJobResponse.ok) {
        const errorData = await createJobResponse.json().catch(() => ({}))
        console.error('[API/NIPR] Failed to create job:', errorData)
        return NextResponse.json({
          success: false,
          error: errorData.error || 'Failed to start NIPR verification. Please try again.'
        }, { status: 500 })
      }

      const createJobData = await createJobResponse.json()
      const newJobId = createJobData.job_id

      console.log('[API/NIPR] Created pending job:', newJobId)

      // Try to acquire a job atomically via Django - this prevents concurrent processing
      // If another job is already processing, this returns empty
      const acquireResponse = await callNiprApi('acquire-job', 'POST')
      const acquireData = await acquireResponse.json()
      const acquiredJobs = acquireData.acquired ? [acquireData.job] : []
      const acquireError = acquireResponse.ok ? null : new Error(acquireData.error || 'Failed to acquire job')

      if (acquireError) {
        console.error('[API/NIPR] Failed to acquire job:', acquireError)
        // Job stays pending, cron will pick it up
        return NextResponse.json({
          success: true,
          processing: true,
          jobId: newJobId,
          message: 'NIPR verification queued. You can track progress below.'
        })
      }

      if (acquiredJobs && acquiredJobs.length > 0) {
        // We acquired a job - process it
        const job = acquiredJobs[0]
        console.log('[API/NIPR] Acquired job for processing:', job.job_id)

        // Build job data for automation
        const jobData: NIPRJobData = {
          job_id: job.job_id,
          job_user_id: job.job_user_id,
          job_last_name: job.job_last_name,
          job_npn: job.job_npn,
          job_ssn_last4: job.job_ssn_last4,
          job_dob: job.job_dob
        }

        // Run automation in background with waitUntil to keep function alive
        const automationPromise = executeNIPRAutomation(jobData).then(async (result) => {
          // Update job with results via Django
          await callNiprApi('complete-job', 'POST', {
            job_id: job.job_id,
            success: result.success,
            files: result.files || [],
            carriers: result.analysis?.unique_carriers || [],
            error: result.error || null,
          })

          // Save carriers and states to user if successful via Django API
          if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0) {
            try {
              const states = result.analysis.licensed_states || []
              const updated = await updateUserNIPRDataViaDjango(job.job_user_id, result.analysis.unique_carriers, states)
              if (updated) {
                console.log(`[API/NIPR] Saved ${result.analysis.unique_carriers.length} carriers and ${states.length} states to user ${job.job_user_id}`)
              } else {
                console.error('[API/NIPR] Failed to save NIPR data via Django API')
              }
            } catch (dbError) {
              console.error('[API/NIPR] Database persistence failed:', dbError)
            }
          }

          // Trigger processing of next pending job
          await triggerNextJobProcessing()
        }).catch(async (err) => {
          console.error('[API/NIPR] Background automation failed:', err)
          // Mark job as failed via Django
          try {
            await callNiprApi('complete-job', 'POST', {
              job_id: job.job_id,
              success: false,
              files: [],
              carriers: [],
              error: err instanceof Error ? err.message : String(err),
            })
            // Still try to process next job
            await triggerNextJobProcessing()
          } catch (rpcError) {
            console.error('[API/NIPR] Failed to mark job as failed:', rpcError)
          }
        })

        // Keep serverless function alive until automation completes
        waitUntil(automationPromise)
      } else {
        // No job acquired - another job is already processing
        console.log('[API/NIPR] Job queued, another job is processing:', newJobId)
      }

      // Return immediately with job ID so frontend can poll for progress
      return NextResponse.json({
        success: true,
        processing: true,
        jobId: newJobId,
        message: 'NIPR verification queued. You can track progress below.'
      })

    } else {
      // No user authenticated - run directly (legacy mode)
      console.log('[API/NIPR] Running in legacy mode (no user)')

      const jobData: NIPRJobData = {
        job_id: `legacy-${Date.now()}`,
        job_user_id: '',
        job_last_name: lastName,
        job_npn: npn,
        job_ssn_last4: ssn,
        job_dob: dob
      }

      const result = await executeNIPRAutomation(jobData)

      return NextResponse.json(result, { status: result.success ? 200 : 500 })
    }

  } catch (error) {
    console.error('[API/NIPR] Error:', error)

    let userMessage = 'NIPR automation failed. Please try again.'

    if (error instanceof Error) {
      if (error.message.includes('HyperAgent') || error.message.includes('browser')) {
        userMessage = 'Browser automation error. Please try again.'
      } else if (error.message.includes('timeout')) {
        userMessage = 'Automation timed out. Please try again.'
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        userMessage = 'Network error occurred. Please check your internet connection and try again.'
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: userMessage,
        files: [],
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : String(error)
        })
      },
      { status: 500 }
    )
  }
}

/**
 * Trigger processing of the next pending job
 * Called after a job completes to immediately process the next one
 */
async function triggerNextJobProcessing(): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    if (!baseUrl) {
      console.log('[API/NIPR] No base URL configured, cron will pick up next job')
      return
    }

    const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    console.log('[API/NIPR] Triggering next job processing...')

    // Fire-and-forget: Don't await the response
    // This ensures each job runs in its own serverless function with fresh timeout
    fetch(`${url}/api/nipr/process`, {
      method: 'POST',
      headers: {
        'x-internal-call': 'true'
      }
    }).catch(err => {
      console.log('[API/NIPR] Failed to trigger next job, cron will pick it up:', err)
    })
  } catch (err) {
    console.log('[API/NIPR] Failed to trigger next job, cron will pick it up:', err)
  }
}

