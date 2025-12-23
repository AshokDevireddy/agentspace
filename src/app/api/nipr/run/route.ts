import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import type { NIPRInput } from '@/lib/nipr'
import { updateUserNIPRData } from '@/lib/supabase-helpers'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { executeNIPRAutomation, type NIPRJobData } from '@/lib/nipr/automation'

export const maxDuration = 300 // 5 minutes timeout for long-running automation

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from server-side session
    const supabase = await createServerClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    // Get user record from database if authenticated
    let currentUser: { id: string; is_admin?: boolean } | null = null
    if (authUser) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, is_admin')
        .eq('auth_user_id', authUser.id)
        .single()
      currentUser = userData
    }

    const supabaseAdmin = createAdminClient()

    // Check if NIPR has already been completed for this user (has carriers)
    if (currentUser?.id) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('unique_carriers')
        .eq('id', currentUser.id)
        .single()

      // Check if unique_carriers exists and has data
      const carriers = userData?.unique_carriers as string[] | null
      if (carriers && carriers.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'NIPR verification has already been completed for your account',
          alreadyCompleted: true
        }, { status: 400 })
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

    // Check if nipr_jobs table exists
    const useQueue = await checkQueueTableExists(supabaseAdmin)

    if (useQueue && currentUser?.id) {
      // Create job as PENDING - database is source of truth for concurrency
      const { data: newJob, error: insertError } = await supabaseAdmin
        .from('nipr_jobs')
        .insert({
          user_id: currentUser.id,
          last_name: lastName,
          npn: npn,
          ssn_last4: ssn,
          dob: dob,
          status: 'pending'
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[API/NIPR] Failed to create job:', insertError)
        return NextResponse.json({
          success: false,
          error: 'Failed to start NIPR verification. Please try again.'
        }, { status: 500 })
      }

      console.log('[API/NIPR] Created pending job:', newJob.id)

      // Try to acquire a job atomically - this prevents concurrent processing
      // If another job is already processing, this returns empty
      const { data: acquiredJobs, error: acquireError } = await supabaseAdmin.rpc('acquire_nipr_job')

      if (acquireError) {
        console.error('[API/NIPR] Failed to acquire job:', acquireError)
        // Job stays pending, cron will pick it up
        return NextResponse.json({
          success: true,
          processing: true,
          jobId: newJob.id,
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
          const adminClient = createAdminClient()

          // Update job with results
          await adminClient.rpc('complete_nipr_job', {
            p_job_id: job.job_id,
            p_success: result.success,
            p_files: result.files || [],
            p_carriers: result.analysis?.unique_carriers || [],
            p_error: result.error || null
          })

          // Save carriers and states to user if successful
          if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0) {
            try {
              const states = result.analysis.unique_states || []
              await updateUserNIPRData(adminClient, job.job_user_id, result.analysis.unique_carriers, states)
              console.log(`[API/NIPR] Saved ${result.analysis.unique_carriers.length} carriers and ${states.length} states to user ${job.job_user_id}`)
            } catch (dbError) {
              console.error('[API/NIPR] Database persistence failed:', dbError)
            }
          }

          // Trigger processing of next pending job
          await triggerNextJobProcessing()
        }).catch(async (err) => {
          console.error('[API/NIPR] Background automation failed:', err)
          // Mark job as failed
          try {
            const adminClient = createAdminClient()
            await adminClient.rpc('complete_nipr_job', {
              p_job_id: job.job_id,
              p_success: false,
              p_files: [],
              p_carriers: [],
              p_error: err instanceof Error ? err.message : String(err)
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
        console.log('[API/NIPR] Job queued, another job is processing:', newJob.id)
      }

      // Return immediately with job ID so frontend can poll for progress
      return NextResponse.json({
        success: true,
        processing: true,
        jobId: newJob.id,
        message: 'NIPR verification queued. You can track progress below.'
      })

    } else {
      // Queue table doesn't exist or no user - run directly (legacy mode)
      console.log('[API/NIPR] Running in legacy mode (no queue)')

      const jobData: NIPRJobData = {
        job_id: `legacy-${Date.now()}`,
        job_user_id: currentUser?.id || '',
        job_last_name: lastName,
        job_npn: npn,
        job_ssn_last4: ssn,
        job_dob: dob
      }

      const result = await executeNIPRAutomation(jobData)

      // Save carriers and states if successful and user is authenticated
      if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0 && currentUser?.id) {
        try {
          const states = result.analysis.unique_states || []
          await updateUserNIPRData(supabaseAdmin, currentUser.id, result.analysis.unique_carriers, states)
          console.log(`[API/NIPR] Saved ${result.analysis.unique_carriers.length} carriers and ${states.length} states to user ${currentUser.id}`)
          result.analysis.savedToDatabase = true
          result.analysis.userId = currentUser.id
        } catch (dbError) {
          console.error('[API/NIPR] Database persistence failed:', dbError)
          if (result.analysis) {
            result.analysis.savedToDatabase = false
          }
        }
      }

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

/**
 * Check if the nipr_jobs table exists
 */
async function checkQueueTableExists(supabase: ReturnType<typeof createAdminClient>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nipr_jobs')
      .select('id')
      .limit(0)

    return !error
  } catch {
    return false
  }
}
