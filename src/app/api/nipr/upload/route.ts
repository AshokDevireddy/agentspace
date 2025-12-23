import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { updateUserNIPRData } from '@/lib/supabase-helpers'
import { analyzePDFReport } from '@/lib/nipr/pdf-analyzer'
import fs from 'fs'
import path from 'path'
import os from 'os'

export const maxDuration = 300 // 5 minutes for AI analysis

/**
 * Handle NIPR PDF document upload and analysis
 * This provides a faster alternative to the automation process
 */
export async function POST(request: NextRequest) {
  console.log('[API/NIPR/UPLOAD] Starting NIPR document upload and analysis...')

  try {
    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({
        success: false,
        error: 'Only PDF files are accepted'
      }, { status: 400 })
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'File size exceeds 50MB limit'
      }, { status: 400 })
    }

    console.log(`[API/NIPR/UPLOAD] Received file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`)

    // Save file temporarily
    const tempDir = os.tmpdir()
    const tempFileName = `nipr-upload-${user.id}-${Date.now()}.pdf`
    const tempFilePath = path.join(tempDir, tempFileName)

    try {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      fs.writeFileSync(tempFilePath, buffer)
      console.log(`[API/NIPR/UPLOAD] Saved temp file: ${tempFilePath}`)
    } catch (writeError) {
      console.error('[API/NIPR/UPLOAD] Failed to save temp file:', writeError)
      return NextResponse.json({
        success: false,
        error: 'Failed to process uploaded file'
      }, { status: 500 })
    }

    // Analyze the PDF
    console.log('[API/NIPR/UPLOAD] Starting AI analysis...')
    const startTime = Date.now()
    const analysisResult = await analyzePDFReport(tempFilePath)
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[API/NIPR/UPLOAD] Analysis completed in ${duration}s`)

    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath)
      console.log('[API/NIPR/UPLOAD] Cleaned up temp file')
    } catch (cleanupError) {
      console.warn('[API/NIPR/UPLOAD] Failed to clean up temp file:', cleanupError)
    }

    if (!analysisResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to analyze PDF. Please ensure it is a valid NIPR PDB report.',
        details: 'The AI could not extract carrier information from the document.'
      }, { status: 422 })
    }

    // Save carriers and states to user profile
    if (analysisResult.unique_carriers && analysisResult.unique_carriers.length > 0) {
      try {
        const states = analysisResult.unique_states || []
        const adminClient = createAdminClient()
        await updateUserNIPRData(adminClient, user.id, analysisResult.unique_carriers, states)
        console.log(`[API/NIPR/UPLOAD] Saved ${analysisResult.unique_carriers.length} carriers and ${states.length} states to user ${user.id}`)
      } catch (dbError) {
        console.error('[API/NIPR/UPLOAD] Failed to save NIPR data:', dbError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed NIPR document`,
      analysis: {
        success: analysisResult.success,
        carriers: analysisResult.unique_carriers,
        licensedStates: analysisResult.licensedStates,
        analyzedAt: analysisResult.analyzedAt
      },
      metrics: {
        duration: `${duration}s`,
        carriersFound: analysisResult.unique_carriers.length,
        residentStates: analysisResult.licensedStates.resident.length,
        nonResidentStates: analysisResult.licensedStates.nonResident.length
      }
    })

  } catch (error) {
    console.error('[API/NIPR/UPLOAD] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process NIPR document',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
