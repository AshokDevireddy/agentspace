// API ROUTE: /api/upload-policy-reports/jobs
// This endpoint fetches ingest jobs and their files for the user's agency
// Used to display uploaded policy report files in the UI
// Replaces the old bucket-based file listing

import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
    const adminClient = createAdminClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    // Get agency ID
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', user.id)
      .single()

    if (userError || !userData || !userData.agency_id) {
      return NextResponse.json(
        { error: 'User not found or not associated with an agency' },
        { status: 404 }
      )
    }

    const agencyId = userData.agency_id

    // Fetch recent ingest jobs for this agency (last 30 days, ordered by most recent)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: jobs, error: jobsError } = await adminClient
      .from('ingest_job')
      .select(`
        job_id,
        expected_files,
        parsed_files,
        status,
        created_at,
        updated_at
      `)
      .eq('agency_id', agencyId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50) // Limit to most recent 50 jobs

    if (jobsError) {
      console.error('Error fetching ingest jobs:', jobsError)
      return NextResponse.json(
        { error: 'Failed to fetch ingest jobs', detail: jobsError.message },
        { status: 500 }
      )
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ files: [] })
    }

    // Fetch all files for these jobs
    const jobIds = jobs.map(job => job.job_id)

    const { data: files, error: filesError } = await adminClient
      .from('ingest_job_file')
      .select(`
        file_id,
        job_id,
        file_name,
        status,
        parsed_rows,
        error_message,
        created_at
      `)
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })

    if (filesError) {
      console.error('Error fetching ingest job files:', filesError)
      return NextResponse.json(
        { error: 'Failed to fetch job files', detail: filesError.message },
        { status: 500 }
      )
    }

    // Group files by job and format response
    const filesByJob = new Map<string, typeof files>()
    files?.forEach(file => {
      if (!filesByJob.has(file.job_id)) {
        filesByJob.set(file.job_id, [])
      }
      filesByJob.get(file.job_id)!.push(file)
    })

    // Format response to match expected structure
    const formattedFiles = jobs.flatMap(job => {
      const jobFiles = filesByJob.get(job.job_id) || []
      return jobFiles.map(file => ({
        id: file.file_id,
        name: file.file_name,
        job_id: file.job_id,
        status: file.status,
        parsed_rows: file.parsed_rows,
        error_message: file.error_message,
        created_at: file.created_at,
        job_status: job.status,
        job_expected_files: job.expected_files,
        job_parsed_files: job.parsed_files,
        job_created_at: job.created_at
      }))
    })

    return NextResponse.json({ 
      files: formattedFiles,
      jobs: jobs.map(job => ({
        job_id: job.job_id,
        expected_files: job.expected_files,
        parsed_files: job.parsed_files,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at
      }))
    })

  } catch (error) {
    console.error('API Error in upload-policy-reports/jobs:', error)
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

