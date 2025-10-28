import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// THIS ENDPOINT SHOULD BE USING SUPABASE/SSR BC AUTH HELPER IS DEPRECATED
// https://supabase.com/docs/guides/auth/server-side/nextjs?queryGroups=router&router=hybrid
// https://supabase.com/docs/guides/auth/auth-helpers/nextjs

export async function GET(request: Request) {
  try {
    // Get user_id from URL search params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id parameter is required' },
        { status: 400 }
      )
    }

    // console.log('Fetching profile for user ID:', userId)

    // ⚠️  SECURITY WARNING: Using admin client for TESTING ONLY
    // This bypasses ALL RLS policies - replace with proper server client later
    const supabase = createAdminClient()

    // Fetch user data from the users table using auth_user_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    // Fetch all deals for this user to calculate real-time production and policies sold
    const { data: dealsData, error: dealsError } = await supabase
      .from('deals')
      .select('agent_id, carrier_id, annual_premium, billing_cycle, policy_effective_date, status')
      .eq('agent_id', userData.id)
      .not('policy_effective_date', 'is', null)

    let totalProduction = 0
    let totalPoliciesSold = 0

    if (!dealsError && dealsData) {
      // Get all unique carrier_ids and statuses
      const carrierIds = new Set<string>()
      const rawStatuses = new Set<string>()

      dealsData.forEach(deal => {
        if (deal.carrier_id && deal.status) {
          carrierIds.add(deal.carrier_id)
          rawStatuses.add(deal.status)
        }
      })

      // Fetch status mappings to filter for positive impact deals
      const { data: statusMappings, error: mappingError } = await supabase
        .from('status_mapping')
        .select('carrier_id, raw_status, impact')
        .in('carrier_id', Array.from(carrierIds))
        .in('raw_status', Array.from(rawStatuses))

      if (mappingError) {
        console.error('Error fetching status mappings:', mappingError)
      }

      // Create impact map
      const impactMap = new Map<string, string>()
      statusMappings?.forEach((mapping: any) => {
        const key = `${mapping.carrier_id}|${mapping.raw_status}`
        impactMap.set(key, mapping.impact)
      })

      // Filter deals to only include positive impact deals
      const positiveDeals = dealsData.filter(deal => {
        if (!deal.carrier_id || !deal.status) return false
        const key = `${deal.carrier_id}|${deal.status}`
        const impact = impactMap.get(key)
        return impact === 'positive'
      })

      // Get today's date for limiting calculations
      const today = new Date()
      today.setHours(23, 59, 59, 999)

      // Calculate production using the same logic as scoreboard
      positiveDeals.forEach(deal => {
        const annualPremium = Number(deal.annual_premium) || 0
        if (annualPremium === 0) return

        const billingCycle = deal.billing_cycle || 'monthly'
        const effectiveDate = deal.policy_effective_date
        if (!effectiveDate) return

        // Calculate payment amount and frequency based on billing cycle
        let paymentAmount: number
        let monthsInterval: number

        switch (billingCycle.toLowerCase()) {
          case 'monthly':
            paymentAmount = annualPremium / 12
            monthsInterval = 1
            break
          case 'quarterly':
            paymentAmount = annualPremium / 4
            monthsInterval = 3
            break
          case 'semi-annually':
            paymentAmount = annualPremium / 2
            monthsInterval = 6
            break
          case 'annually':
            paymentAmount = annualPremium
            monthsInterval = 12
            break
          default:
            paymentAmount = annualPremium / 12
            monthsInterval = 1
        }

        const effective = new Date(effectiveDate + 'T00:00:00')
        let hasPayment = false

        // Generate payment dates up to today (not future dates)
        for (let i = 0; i < 120; i++) { // Max 10 years of payments
          const paymentDate = new Date(effective)
          paymentDate.setMonth(effective.getMonth() + (i * monthsInterval))

          // Only count payments that have occurred (up to today)
          if (paymentDate <= today) {
            totalProduction += paymentAmount
            hasPayment = true
          } else {
            // Stop once we hit future dates
            break
          }
        }

        // Count this policy if it had at least one payment
        if (hasPayment) {
          totalPoliciesSold += 1
        }
      })
    }

    // Return sanitized user profile data
    const profileData = {
      id: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      fullName: `${userData.first_name} ${userData.last_name}`,
      createdAt: userData.created_at,
      totalProduction: totalProduction,
      totalPoliciesSold: totalPoliciesSold,
      // Include agency_id so clients can scope queries by agency
      agency_id: userData.agency_id || null,
      // Include status, role, and is_admin for onboarding checks
      status: userData.status,
      role: userData.role,
      is_admin: userData.is_admin,
    }

    return NextResponse.json({
      success: true,
      data: profileData
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}