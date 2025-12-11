import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Get the status of a specific NIPR job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createServerClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user record
    const { data: currentUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get job status (only if it belongs to the user)
    const { data: job, error } = await supabase
      .from('nipr_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', currentUser.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Calculate queue position if pending
    let position: number | null = null
    if (job.status === 'pending') {
      const { data: pendingJobs } = await supabase
        .from('nipr_jobs')
        .select('id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (pendingJobs) {
        const idx = pendingJobs.findIndex(j => j.id === jobId)
        position = idx >= 0 ? idx + 1 : null
      }
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      position,
      progress: job.progress || 0,
      progressMessage: job.progress_message || (job.status === 'pending' ? 'Waiting in queue...' : ''),
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      resultFiles: job.result_files,
      resultCarriers: job.result_carriers,
      errorMessage: job.error_message
    })

  } catch (error) {
    console.error('[API/NIPR/JOB] Error:', error)
    return NextResponse.json({
      error: 'Failed to get job status'
    }, { status: 500 })
  }
}
