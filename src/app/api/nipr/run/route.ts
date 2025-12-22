import { NextRequest, NextResponse } from 'next/server'
import type { NIPRInput } from '@/lib/nipr'
import { updateUserCarriers } from '@/lib/supabase-helpers'
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
      // Create job and start processing immediately
      // HyperAgent queue manager limits concurrent local browser instances
      const { data: newJob, error: insertError } = await supabaseAdmin
        .from('nipr_jobs')
        .insert({
          user_id: currentUser.id,
          last_name: lastName,
          npn: npn,
          ssn_last4: ssn,
          dob: dob,
          status: 'processing',
          started_at: new Date().toISOString()
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

      console.log('[API/NIPR] Starting HyperAgent automation for job:', newJob.id)

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
      }).catch(async (err) => {
        console.error('[API/NIPR] Background automation failed:', err)
        // Mark job as failed
        try {
          const adminClient = createAdminClient()
          await adminClient.rpc('complete_nipr_job', {
            p_job_id: newJob.id,
            p_success: false,
            p_files: [],
            p_carriers: [],
            p_error: err instanceof Error ? err.message : String(err)
          })
        } catch (rpcError) {
          console.error('[API/NIPR] Failed to mark job as failed:', rpcError)
        }
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
