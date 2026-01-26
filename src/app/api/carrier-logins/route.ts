// API ROUTE: /api/carrier-logins
// Creates or updates a parsing_info record for the current admin user's agency

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface CarrierLoginBody {
  carrier_name?: string
  login?: string
  password?: string
}

// POST /api/carrier-logins
export async function POST(request: Request) {
  try {
    const admin = createAdminClient()

    const body = (await request.json().catch(() => null)) as CarrierLoginBody | null

    console.log('[carrier-logins] Incoming request body:', body)

    if (!body) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          detail: 'Body must be a JSON object',
        },
        { status: 400 }
      )
    }

    const { carrier_name, login, password } = body

    console.log('[carrier-logins] Parsed fields:', {
      carrier_name,
      hasLogin: !!login,
      hasPassword: !!password,
    })

    if (!carrier_name || !login || !password) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          detail: 'carrier_name, login, and password are required',
        },
        { status: 400 }
      )
    }

    // Authenticate the caller using the Bearer token, consistent with other admin APIs
    const authHeader = request.headers.get('authorization')

    console.log('[carrier-logins] Authorization header present:', !!authHeader)

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'No valid token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token)

    console.log('[carrier-logins] Auth result:', {
      hasUser: !!user,
      userError,
    })

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get the current user's ID, agency, and admin status
    const { data: userData, error: userDataError } = await admin
      .from('users')
      .select('id, agency_id, is_admin')
      .eq('auth_user_id', user.id)
      .single()

    console.log('[carrier-logins] Loaded userData:', {
      hasUserData: !!userData,
      userId: userData?.id,
      agencyId: userData?.agency_id,
      is_admin: userData?.is_admin,
      userDataError,
    })

    if (userDataError || !userData) {
      return NextResponse.json(
        {
          error: 'User not found',
          detail: 'Failed to fetch user information',
        },
        { status: 404 }
      )
    }

    if (!userData.is_admin) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          detail: 'Admin access required to save carrier logins',
        },
        { status: 403 }
      )
    }

    if (!userData.agency_id) {
      return NextResponse.json(
        {
          error: 'User not associated with an agency',
          detail: 'User must be associated with an agency to save carrier logins',
        },
        { status: 403 }
      )
    }

    // Look up the carrier_id by carrier name
    const { data: carrier, error: carrierError } = await admin
      .from('carriers')
      .select('id')
      .eq('name', carrier_name)
      .eq('is_active', true)
      .maybeSingle()

    console.log('[carrier-logins] Carrier lookup:', {
      carrierName: carrier_name,
      carrierId: carrier?.id,
      carrierError,
    })

    if (carrierError) {
      console.error('Carrier lookup error:', carrierError)
      return NextResponse.json(
        {
          error: 'Failed to look up carrier',
          detail: 'Database query encountered an error',
        },
        { status: 500 }
      )
    }

    if (!carrier) {
      return NextResponse.json(
        {
          error: 'Carrier not found',
          detail: `No active carrier found with name "${carrier_name}"`,
        },
        { status: 400 }
      )
    }

    // Check for existing parsing_info for this agency, carrier, and login (email/username)
    const { data: existingParsingInfo, error: existingError } = await admin
      .from('parsing_info')
      .select('id, password')
      .eq('agency_id', userData.agency_id)
      .eq('carrier_id', carrier.id)
      .eq('login', login)
      .maybeSingle()

    console.log('[carrier-logins] Existing parsing_info lookup:', {
      existingParsingInfo,
      existingError,
    })

    let parsingInfoResult: { id: string; created_at?: string; password?: string } = existingParsingInfo || { id: '', created_at: '' }

    if (existingError) {
      console.error(
        '[carrier-logins] Error looking up existing parsing_info:',
        existingError
      )
    } else if (existingParsingInfo) {
      // If record exists and password is different, update it to the new value
      if (existingParsingInfo.password !== password) {
        const { data: updated, error: updateError } = await admin
          .from('parsing_info')
          .update({ password })
          .eq('id', existingParsingInfo.id)
          .select('id, created_at')
          .maybeSingle()

        console.log('[carrier-logins] Update result:', {
          updated,
          updateError,
        })

        if (updateError) {
          return NextResponse.json(
            {
              error: 'Failed to update carrier login',
              detail: 'Database update encountered an error',
            },
            { status: 500 }
          )
        }

        parsingInfoResult = updated ?? existingParsingInfo
      } else {
        // Password is the same; just return existing record
        console.log(
          '[carrier-logins] Existing carrier login found with same password; no update needed.'
        )
      }
    } else {
      // No existing record; insert parsing_info row for this admin as the agent
      const { data: inserted, error: insertError } = await admin
        .from('parsing_info')
        .insert({
          carrier_id: carrier.id,
          agent_id: userData.id,
          agency_id: userData.agency_id,
          login,
          password,
        })
        .select('id, created_at')
        .single()

      console.log('[carrier-logins] Insert result:', {
        inserted,
        insertError,
      })

      if (insertError) {
        console.error('Error inserting parsing_info:', insertError)
        return NextResponse.json(
          {
            error: 'Failed to save carrier login',
            detail: 'Database insert encountered an error',
          },
          { status: 500 }
        )
      }

      parsingInfoResult = inserted || { id: '', created_at: '' }
    }

    return NextResponse.json(
      {
        success: true,
        data: parsingInfoResult,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('API Error (POST /api/carrier-logins):', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      {
        status: 500,
      }
    )
  }
}


