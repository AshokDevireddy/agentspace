import { NextRequest, NextResponse } from 'next/server'
import type { NIPRInput } from '@/lib/nipr'
import { updateUserCarriers } from '@/lib/supabase-helpers'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { checkRateLimit, recordRequest, getSecondsUntilReset } from '@/lib/rate-limiter'
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

    // Rate limiting check - use user ID if authenticated, fall back to IP
    const rateLimitIdentifier = currentUser?.id
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitIdentifier)
    if (!allowed) {
      const retryAfter = getSecondsUntilReset(resetAt)
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Maximum 20 requests per hour.',
          retryAfter
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      )
    }

    // Record this request for rate limiting
    recordRequest(rateLimitIdentifier)

    const supabaseAdmin = createAdminClient()

    // Check if NIPR has already been run for this user
    if (currentUser?.id) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('unique_carriers')
        .eq('id', currentUser.id)
        .single()

      // Check if unique_carriers exists and has data (now text[] type)
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

    // Check if nipr_jobs table exists and use queue, otherwise run directly
    const useQueue = await checkQueueTableExists(supabaseAdmin)

    if (useQueue && currentUser?.id) {
      // Check for existing pending/processing job for this user
      const { data: existingJob } = await supabaseAdmin
        .from('nipr_jobs')
        .select('id, status')
        .eq('user_id', currentUser.id)
        .in('status', ['pending', 'processing'])
        .single()

      if (existingJob) {
        return NextResponse.json({
          success: false,
          error: 'You already have a pending NIPR verification. Please wait for it to complete.',
          jobId: existingJob.id,
          status: existingJob.status
        }, { status: 409 })
      }

      // Try to acquire a job from the queue (check if another job is processing)
      const { data: acquiredJob } = await supabaseAdmin.rpc('acquire_nipr_job')

      if (acquiredJob && acquiredJob.length > 0) {
        // Another job is available to process - but we need to create our own first
        // Release the acquired job back (it wasn't ours)
        await supabaseAdmin
          .from('nipr_jobs')
          .update({ status: 'pending', started_at: null, locked_until: null })
          .eq('id', acquiredJob[0].job_id)
      }

      // Check if any job is currently processing
      const { data: processingJob } = await supabaseAdmin
        .from('nipr_jobs')
        .select('id')
        .eq('status', 'processing')
        .single()

      if (processingJob) {
        // Create job in pending state - it will be picked up later
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
            error: 'Failed to queue NIPR verification. Please try again.'
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          queued: true,
          jobId: newJob.id,
          message: 'Your NIPR verification has been queued. Another verification is currently in progress.',
          position: await getQueuePosition(supabaseAdmin, newJob.id)
        })
      }

      // No job is processing - create and process immediately
      const { data: newJob, error: insertError } = await supabaseAdmin
        .from('nipr_jobs')
        .insert({
          user_id: currentUser.id,
          last_name: lastName,
          npn: npn,
          ssn_last4: ssn,
          dob: dob,
          status: 'processing',
          started_at: new Date().toISOString(),
          locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min lock
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

      console.log('[API/NIPR] Starting automation for job:', newJob.id)

      // Build job data for automation
      const jobData: NIPRJobData = {
        job_id: newJob.id,
        job_user_id: currentUser.id,
        job_last_name: lastName,
        job_npn: npn,
        job_ssn_last4: ssn,
        job_dob: dob
      }

      // Run automation in background (fire and forget)
      // This allows the frontend to poll for progress updates
      const userId = currentUser.id
      executeNIPRAutomation(jobData).then(async (result) => {
        const adminClient = createAdminClient()

        // Update job with results
        await adminClient.rpc('complete_nipr_job', {
          p_job_id: newJob.id,
          p_success: result.success,
          p_files: result.files || [],
          p_carriers: result.analysis?.unique_carriers || [],
          p_error: result.error || null
        })

        // Save carriers to user if successful
        if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0) {
          try {
            await updateUserCarriers(userId, result.analysis.unique_carriers)
            console.log(`[API/NIPR] Saved ${result.analysis.unique_carriers.length} carriers to user ${userId}`)
          } catch (dbError) {
            console.error('[API/NIPR] Database persistence failed:', dbError)
          }
        }

        // Trigger processing of next job in queue
        triggerNextJob(adminClient).catch(err => {
          console.error('[API/NIPR] Failed to trigger next job:', err)
        })
      }).catch(err => {
        console.error('[API/NIPR] Background automation failed:', err)
        // Mark job as failed
        const adminClient = createAdminClient()
        adminClient.rpc('complete_nipr_job', {
          p_job_id: newJob.id,
          p_success: false,
          p_files: [],
          p_carriers: [],
          p_error: err instanceof Error ? err.message : String(err)
        }).catch(console.error)
      })

      // Return immediately with job ID so frontend can poll for progress
      return NextResponse.json({
        success: true,
        processing: true,
        jobId: newJob.id,
        message: 'NIPR verification started. You can track progress below.'
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

      // Save carriers if successful and user is authenticated
      if (result.success && result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0 && currentUser?.id) {
        try {
          await updateUserCarriers(currentUser.id, result.analysis.unique_carriers)
          console.log(`[API/NIPR] Saved ${result.analysis.unique_carriers.length} carriers to user ${currentUser.id}`)
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
      if (error.message.includes('npx playwright install')) {
        userMessage = 'Browser setup required. Please contact support.'
      } else if (error.message.includes('Browser launch failed')) {
        userMessage = 'Browser initialization failed. Please contact support.'
      } else if (error.message.includes('Permission denied')) {
        userMessage = 'File permission error. Please contact support.'
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

/**
 * Get the queue position for a job
 */
async function getQueuePosition(supabase: ReturnType<typeof createAdminClient>, jobId: string): Promise<number> {
  const { data } = await supabase
    .from('nipr_jobs')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (!data) return 1

  const position = data.findIndex(job => job.id === jobId)
  return position >= 0 ? position + 1 : data.length + 1
}

/**
 * Trigger processing of the next job in the queue
 * This is a fire-and-forget operation
 */
async function triggerNextJob(supabase: ReturnType<typeof createAdminClient>): Promise<void> {
  // Release any stale locks first
  await supabase.rpc('release_stale_nipr_locks')

  // Check if there are pending jobs
  const { data: pendingJobs } = await supabase
    .from('nipr_jobs')
    .select('id')
    .eq('status', 'pending')
    .limit(1)

  if (pendingJobs && pendingJobs.length > 0) {
    // Call the process endpoint to handle the next job
    // This will be handled by the cron job or manual trigger
    console.log('[API/NIPR] Pending jobs in queue:', pendingJobs.length)
  }
}
