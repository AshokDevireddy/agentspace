import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Compulife API endpoint
const COMPULIFE_API_URL = 'https://www.compulifeapi.com/api/request/'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check user's subscription tier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier, id')
      .eq('auth_user_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user has Pro or Expert tier
    const tier = userData.subscription_tier || 'free'
    if (tier !== 'pro' && tier !== 'expert') {
      return NextResponse.json(
        {
          error: 'Underwriting tool is only available for Pro and Expert tier users',
          current_tier: tier,
          required_tiers: ['pro', 'expert']
        },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      // Basic fields
      birthMonth,
      birthDay,
      birthYear,
      sex,
      smoker,
      health,
      faceAmount,
      state,
      zipCode,
      // Advanced fields
      heightFeet,
      heightInches,
      weight,
      systolic,
      diastolic,
      bloodPressureMedication,
      cholesterolLevel,
      hdlRatio,
      cholesterolMedication,
      periodCholesterolControlDuration,
      // Tobacco details
      doCigarettes,
      periodCigarettes,
      numCigarettes,
      doCigars,
      periodCigars,
      numCigars,
      doPipe,
      periodPipe,
      doChewingTobacco,
      periodChewingTobacco,
      doNicotinePatchesOrGum,
      periodNicotinePatchesOrGum,
      // Driving record
      hadDriversLicense,
      movingViolations0,
      movingViolations1,
      movingViolations2,
      movingViolations3,
      movingViolations4,
      recklessConviction,
      dwiConviction,
      suspendedConviction,
      moreThanOneAccident,
      periodRecklessConviction,
      periodDwiConviction,
      periodSuspendedConviction,
      periodMoreThanOneAccident,
      // Family history
      numDeaths,
      numContracted,
      // Substance abuse
      alcohol,
      alcoholYearsSinceTreatment,
      drugs,
      drugsYearsSinceTreatment,
    } = body

    // Validate required fields
    if (!birthMonth || !birthDay || !birthYear || !sex || !smoker || !faceAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get Compulife Authorization ID based on environment
    const compulifeEnv = process.env.COMPULIFE_ENV || 'development'
    const authorizationId = compulifeEnv === 'production'
      ? process.env.COMPULIFE_PROD_AUTHORIZATION_ID
      : process.env.COMPULIFE_DEV_AUTHORIZATION_ID

    if (!authorizationId || authorizationId === 'YOUR_DEV_ID_HERE' || authorizationId === 'YOUR_PROD_ID_HERE') {
      console.error('Compulife Authorization ID not configured')
      return NextResponse.json(
        { error: 'Underwriting service is not configured. Please contact your administrator.' },
        { status: 500 }
      )
    }

    // Get the client's IP address from the request headers
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : realIp || '127.0.0.1'

    // Build Compulife API request with basic fields
    const compulifeRequest: Record<string, any> = {
      COMPULIFEAUTHORIZATIONID: authorizationId,
      REMOTE_IP: clientIp,
      BirthMonth: birthMonth,
      BirthDay: birthDay,
      BirthYear: birthYear,
      Sex: sex,
      Smoker: smoker,
      Health: health || 'PP',
      FaceAmount: faceAmount,
      State: state || '0',
      ZipCode: zipCode || '',
      ModeUsed: 'M', // Monthly mode
      NewCategory: '7', // Term life insurance
      CompRating: '4', // All companies
      SortOverride1: 'A', // Sort by premium amount
      ErrOnMissingZipCode: 'ON',
    }

    // Add advanced fields only if they have values
    // Height & Weight
    if (heightFeet) compulifeRequest.HeightFeet = heightFeet
    if (heightInches) compulifeRequest.HeightInches = heightInches
    if (weight) compulifeRequest.Weight = weight

    // Blood Pressure
    if (systolic) compulifeRequest.Systolic = systolic
    if (diastolic) compulifeRequest.Diastolic = diastolic
    if (bloodPressureMedication) compulifeRequest.BloodPressureMedication = bloodPressureMedication

    // Cholesterol
    if (cholesterolLevel) compulifeRequest.CholesterolLevel = cholesterolLevel
    if (hdlRatio) compulifeRequest.HDLRatio = hdlRatio
    if (cholesterolMedication) compulifeRequest.CholesterolMedication = cholesterolMedication
    if (periodCholesterolControlDuration) compulifeRequest.periodCholesterolControlDuration = periodCholesterolControlDuration

    // Tobacco Details
    if (doCigarettes) {
      compulifeRequest.DoCigarettes = 'Y'
      if (periodCigarettes) compulifeRequest.periodCigarettes = periodCigarettes
      if (numCigarettes) compulifeRequest.numCigarettes = numCigarettes
    }
    if (doCigars) {
      compulifeRequest.DoCigars = 'Y'
      if (periodCigars) compulifeRequest.periodCigars = periodCigars
      if (numCigars) compulifeRequest.numCigars = numCigars
    }
    if (doPipe) {
      compulifeRequest.DoPipe = 'Y'
      if (periodPipe) compulifeRequest.periodPipe = periodPipe
    }
    if (doChewingTobacco) {
      compulifeRequest.DoChewingTobacco = 'Y'
      if (periodChewingTobacco) compulifeRequest.periodChewingTobacco = periodChewingTobacco
    }
    if (doNicotinePatchesOrGum) {
      compulifeRequest.DoNicotinePatchesOrGum = 'Y'
      if (periodNicotinePatchesOrGum) compulifeRequest.periodNicotinePatchesOrGum = periodNicotinePatchesOrGum
    }

    // Driving Record
    if (hadDriversLicense) compulifeRequest.hadDriversLicense = hadDriversLicense
    if (movingViolations0) compulifeRequest.movingViolations0 = movingViolations0
    if (movingViolations1) compulifeRequest.movingViolations1 = movingViolations1
    if (movingViolations2) compulifeRequest.movingViolations2 = movingViolations2
    if (movingViolations3) compulifeRequest.movingViolations3 = movingViolations3
    if (movingViolations4) compulifeRequest.movingViolations4 = movingViolations4
    if (recklessConviction) {
      compulifeRequest.recklessConviction = recklessConviction
      if (periodRecklessConviction) compulifeRequest.periodRecklessConviction = periodRecklessConviction
    }
    if (dwiConviction) {
      compulifeRequest.dwiConviction = dwiConviction
      if (periodDwiConviction) compulifeRequest.periodDwiConviction = periodDwiConviction
    }
    if (suspendedConviction) {
      compulifeRequest.suspendedConviction = suspendedConviction
      if (periodSuspendedConviction) compulifeRequest.periodSuspendedConviction = periodSuspendedConviction
    }
    if (moreThanOneAccident) {
      compulifeRequest.moreThanOneAccident = moreThanOneAccident
      if (periodMoreThanOneAccident) compulifeRequest.periodMoreThanOneAccident = periodMoreThanOneAccident
    }

    // Family Medical History
    if (numDeaths) compulifeRequest.numDeaths = numDeaths
    if (numContracted) compulifeRequest.numContracted = numContracted

    // Substance Abuse
    if (alcohol) {
      compulifeRequest.alcohol = alcohol
      if (alcoholYearsSinceTreatment) compulifeRequest.alcoholYearsSinceTreatment = alcoholYearsSinceTreatment
    }
    if (drugs) {
      compulifeRequest.drugs = drugs
      if (drugsYearsSinceTreatment) compulifeRequest.drugsYearsSinceTreatment = drugsYearsSinceTreatment
    }

    console.log('Making Compulife API request:', {
      url: COMPULIFE_API_URL,
      env: compulifeEnv,
      clientIp: clientIp,
      request: {
        ...compulifeRequest,
        COMPULIFEAUTHORIZATIONID: '[REDACTED]',
        REMOTE_IP: clientIp
      }
    })

    // Make request to Compulife API
    const compulifeUrl = `${COMPULIFE_API_URL}?COMPULIFE=${encodeURIComponent(JSON.stringify(compulifeRequest))}`

    const response = await fetch(compulifeUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Compulife API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Compulife API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Log successful request
    console.log('Compulife API response received:', {
      userId: userData.id,
      tier: tier,
      env: compulifeEnv,
      hasResults: !!data
    })

    // Return the results
    return NextResponse.json({
      success: true,
      data: data,
      environment: compulifeEnv,
    })

  } catch (error) {
    console.error('Error in underwriting API:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred while processing your request',
      },
      { status: 500 }
    )
  }
}
