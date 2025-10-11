import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No valid token provided' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token with Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }

    // Get user information including agency
    const { data: userInfo, error: userInfoError } = await supabase
      .from('users')
      .select(`
        id,
        agency_id,
        is_admin,
        agencies(
          id,
          code,
          name
        )
      `)
      .eq('auth_user_id', user.id)
      .single()

    if (userInfoError || !userInfo) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user is admin
    if (!userInfo.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get commission report information
    const { data: commissionReport, error: reportError } = await supabase
      .from('commission_reports')
      .select(`
        id,
        agency_id,
        file_path,
        original_filename,
        file_type,
        file_size,
        carriers!inner(
          name
        )
      `)
      .eq('id', params.reportId)
      .single()

    if (reportError || !commissionReport) {
      return NextResponse.json({ error: 'Commission report not found' }, { status: 404 })
    }

    // Check if user's agency matches report agency
    if (userInfo.agency_id !== commissionReport.agency_id) {
      return NextResponse.json({ error: 'Access denied - different agency' }, { status: 403 })
    }

    // Check if file exists in storage
    if (!commissionReport.file_path) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('commission-reports')
      .download(commissionReport.file_path)

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError)
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 })
    }

    // Create response with file data
    const response = new NextResponse(fileData, {
      status: 200,
      headers: {
        'Content-Type': commissionReport.file_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${commissionReport.original_filename}"`,
        'Content-Length': commissionReport.file_size?.toString() || '',
        'Cache-Control': 'private, no-cache'
      }
    })

    return response

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}