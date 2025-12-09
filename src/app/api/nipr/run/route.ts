import { NextRequest, NextResponse } from 'next/server'
import { runNIPRAutomation } from '@/lib/nipr'
import type { NIPRInput } from '@/lib/nipr'
import { getCurrentUser, updateAgencyCarriers } from '@/lib/supabase-helpers'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, recordRequest, getSecondsUntilReset } from '@/lib/rate-limiter'

export const maxDuration = 300 // 5 minutes timeout for long-running automation

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check - get user or fall back to IP
    const currentUser = await getCurrentUser()
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

    // Check if NIPR has already been run for this agency
    if (currentUser?.agency_id) {
      const supabase = createAdminClient()
      const { data: agency } = await supabase
        .from('agencies')
        .select('unique_carriers')
        .eq('id', currentUser.agency_id)
        .single()

      // Check if unique_carriers exists and has data
      const carriersData = agency?.unique_carriers as { carriers?: string[] } | null
      if (carriersData?.carriers && carriersData.carriers.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'NIPR verification has already been completed for this agency',
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

    console.log('[API/NIPR] Starting automation for:', { lastName, npn })

    // Run the automation
    const result = await runNIPRAutomation({
      lastName,
      npn,
      ssn,
      dob
    })

    if (result.success) {
      // Save unique carriers to database if analysis was successful
      if (result.analysis?.unique_carriers && result.analysis.unique_carriers.length > 0) {
        try {
          if (currentUser?.agency_id) {
            await updateAgencyCarriers(currentUser.agency_id, result.analysis.unique_carriers)
            console.log(`[API/NIPR] Saved ${result.analysis.unique_carriers.length} carriers to agency ${currentUser.agency_id}`)

            // Update analysis result with database persistence metadata
            result.analysis.savedToDatabase = true
            result.analysis.agencyId = currentUser.agency_id
          } else {
            console.warn('[API/NIPR] No agency_id found for current user - carriers not saved to database')
            result.analysis.savedToDatabase = false
          }
        } catch (dbError) {
          console.error('[API/NIPR] Database persistence failed:', dbError)
          // Continue - don't break automation for DB failures
          if (result.analysis) {
            result.analysis.savedToDatabase = false
          }
        }
      }

      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 500 })
    }

  } catch (error) {
    console.error('[API/NIPR] Error:', error)

    // Provide user-friendly error messages based on error type
    let userMessage = 'NIPR automation failed. Please try again.'

    if (error instanceof Error) {
      // Browser-specific errors
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
        // Include detailed error in development mode only
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : String(error)
        })
      },
      { status: 500 }
    )
  }
}
