import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'

/**
 * Get the status of a specific NIPR job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const session = await getSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get job status from Django API
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/nipr/job/${jobId}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to get job status' }, { status: response.status })
    }

    const job = await response.json()

    return NextResponse.json({
      id: job.job_id,
      status: job.status,
      position: job.queue_position || null,
      progress: job.progress || 0,
      progressMessage: job.progress_message || (job.status === 'pending' ? 'Waiting in queue...' : ''),
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      resultFiles: job.result_files,
      resultCarriers: job.result_carriers,
      errorMessage: job.error_message,
    })

  } catch (error) {
    console.error('[API/NIPR/JOB] Error:', error)
    return NextResponse.json({
      error: 'Failed to get job status'
    }, { status: 500 })
  }
}
