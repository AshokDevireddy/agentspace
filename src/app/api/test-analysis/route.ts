import { NextRequest, NextResponse } from 'next/server'
import { analyzePDFReport } from '@/lib/nipr/pdf-analyzer'
import path from 'path'
import fs from 'fs'

export const maxDuration = 300 // 5 minutes for AI analysis

export async function GET(request: NextRequest) {
  console.log('[TEST-ANALYSIS] Starting PDF analysis test...')

  try {
    // Path to the already downloaded report
    const reportPath = path.join(process.cwd(), 'public', 'nipr-downloads', 'report_2025-12-08.pdf')

    console.log('[TEST-ANALYSIS] Looking for PDF at:', reportPath)

    if (!fs.existsSync(reportPath)) {
      return NextResponse.json({
        success: false,
        error: 'PDF file not found',
        expectedLocation: reportPath,
        message: 'Run the NIPR automation first to generate the PDF'
      }, { status: 404 })
    }

    const stats = fs.statSync(reportPath)
    const fileSizeKB = (stats.size / 1024).toFixed(1)

    console.log(`[TEST-ANALYSIS] Found PDF: ${fileSizeKB}KB`)
    console.log('[TEST-ANALYSIS] Starting AI analysis...')

    const startTime = Date.now()
    const result = await analyzePDFReport(reportPath)
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`[TEST-ANALYSIS] Analysis completed in ${duration}s`)

    // Enhanced response with debugging info
    const response = {
      success: result.success,
      analysisResult: result,
      testMetrics: {
        duration: `${duration}s`,
        fileSizeKB: fileSizeKB,
        carriersFound: result.unique_carriers.length,
        hasTextContent: result.success || result.unique_carriers.length > 0
      },
      summary: {
        status: result.success ? 'SUCCESS' : 'FAILED',
        carriersExtracted: result.unique_carriers.length,
        residentStates: result.licensedStates.resident.length,
        nonResidentStates: result.licensedStates.nonResident.length,
        analyzedAt: result.analyzedAt
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[TEST-ANALYSIS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// Also support POST for testing
export async function POST(request: NextRequest) {
  return GET(request)
}