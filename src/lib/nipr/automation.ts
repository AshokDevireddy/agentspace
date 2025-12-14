/**
 * NIPR Automation Service
 * Browser automation for retrieving PDB Detail Reports from nipr.com
 *
 * Uses Supabase database queue for concurrency control on serverless (Vercel)
 */

import { chromium, Browser } from 'playwright'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import type { NIPRInput, NIPRResult, NIPRConfig, NIPRAnalysisResult } from './types'
import { analyzePDFReport } from './pdf-analyzer'
import { createAdminClient } from '@/lib/supabase/server'

// Progress steps with percentages and messages
const PROGRESS_STEPS = {
  STARTING: { progress: 0, message: 'Starting verification...' },
  BROWSER_LAUNCH: { progress: 5, message: 'Launching secure browser...' },
  NAVIGATING: { progress: 10, message: 'Connecting to NIPR...' },
  ENTERING_INFO: { progress: 20, message: 'Entering your information...' },
  VERIFYING_IDENTITY: { progress: 30, message: 'Verifying your identity...' },
  SELECTING_REPORT: { progress: 40, message: 'Selecting report type...' },
  PROCESSING_REQUEST: { progress: 50, message: 'Processing your request...' },
  CONFIRMING_DETAILS: { progress: 60, message: 'Confirming your details...' },
  FINALIZING_REQUEST: { progress: 70, message: 'Finalizing your request...' },
  DOWNLOADING_REPORT: { progress: 80, message: 'Downloading your report...' },
  ANALYZING_REPORT: { progress: 90, message: 'AI is analyzing your report...' },
  COMPLETE: { progress: 100, message: 'Verification complete!' },
} as const

// Generate unique ID for each request to prevent file collisions
function generateRequestId(): string {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

/**
 * Update job progress in the database
 */
async function updateProgress(jobId: string, step: keyof typeof PROGRESS_STEPS): Promise<void> {
  if (!jobId || jobId.startsWith('legacy-')) {
    // Skip progress updates for legacy jobs without database tracking
    return
  }

  const { progress, message } = PROGRESS_STEPS[step]

  try {
    const supabase = createAdminClient()
    await supabase.rpc('update_nipr_job_progress', {
      p_job_id: jobId,
      p_progress: progress,
      p_message: message
    })
    console.log(`[NIPR] Progress: ${progress}% - ${message}`)
  } catch (error) {
    // Non-blocking - just log the error
    console.error('[NIPR] Failed to update progress:', error)
  }
}

// Validate and load NIPR configuration from environment variables
export const getDefaultConfig = (): NIPRConfig => {
  // Required billing environment variables
  const requiredBillingVars = [
    'NIPR_BILLING_FIRST_NAME',
    'NIPR_BILLING_LAST_NAME',
    'NIPR_BILLING_ADDRESS',
    'NIPR_BILLING_CITY',
    'NIPR_BILLING_STATE',
    'NIPR_BILLING_ZIP',
    'NIPR_BILLING_PHONE'
  ]

  // Required payment environment variables
  const requiredPaymentVars = [
    'NIPR_CARD_NUMBER',
    'NIPR_CARD_EXPIRY',
    'NIPR_CARD_CVC'
  ]

  // Check for missing environment variables
  const missingVars = [...requiredBillingVars, ...requiredPaymentVars].filter(
    varName => !process.env[varName]
  )

  if (missingVars.length > 0) {
    throw new Error(`Missing required NIPR environment variables: ${missingVars.join(', ')}`)
  }

  return {
    billing: {
      firstName: process.env.NIPR_BILLING_FIRST_NAME!,
      lastName: process.env.NIPR_BILLING_LAST_NAME!,
      address: process.env.NIPR_BILLING_ADDRESS!,
      city: process.env.NIPR_BILLING_CITY!,
      state: process.env.NIPR_BILLING_STATE!,
      zip: process.env.NIPR_BILLING_ZIP!,
      phone: process.env.NIPR_BILLING_PHONE!,
    },
    payment: {
      cardNumber: process.env.NIPR_CARD_NUMBER!,
      expiry: process.env.NIPR_CARD_EXPIRY!,
      cvc: process.env.NIPR_CARD_CVC!,
    },
    analyzeWithAI: process.env.ANALYZE_REPORTS_WITH_AI !== 'false',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  }
}

/**
 * Job data structure from the database queue
 */
export interface NIPRJobData {
  job_id: string
  job_user_id: string
  job_last_name: string
  job_npn: string
  job_ssn_last4: string
  job_dob: string
}

/**
 * Execute the NIPR automation for a specific job
 * This is called by the job processor, not directly by users
 */
export async function executeNIPRAutomation(job: NIPRJobData): Promise<NIPRResult> {
  const config = getDefaultConfig()
  const requestId = generateRequestId()

  // Create downloads folder
  const downloadsFolder = path.join(process.cwd(), 'public', 'nipr-downloads')
  if (!fs.existsSync(downloadsFolder)) {
    fs.mkdirSync(downloadsFolder, { recursive: true })
  }

  let browser: Browser | null = null

  const input: NIPRInput = {
    lastName: job.job_last_name,
    npn: job.job_npn,
    ssn: job.job_ssn_last4,
    dob: job.job_dob
  }

  try {
    console.log(`[NIPR] Starting automation (job: ${job.job_id}, request: ${requestId})...`)
    await updateProgress(job.job_id, 'STARTING')

    // Launch browser in headless mode
    await updateProgress(job.job_id, 'BROWSER_LAUNCH')
    try {
      browser = await chromium.launch({ headless: true })
      console.log('[NIPR] Browser launched successfully')
    } catch (error: any) {
      console.error('[NIPR] Browser launch failed:', error.message)

      // Provide specific error messages for common browser issues
      if (error.message.includes("Executable doesn't exist")) {
        throw new Error(
          'Playwright browsers not installed. Please run: npx playwright install'
        )
      }

      if (error.message.includes('Permission denied')) {
        throw new Error(
          'Browser executable permission denied. Please check file permissions.'
        )
      }

      // Re-throw the original error for other cases
      throw error
    }
    const page = await browser.newPage()

    // Navigate to NIPR
    await updateProgress(job.job_id, 'NAVIGATING')
    console.log('[NIPR] Navigating to NIPR...')
    await page.goto('https://pdb.nipr.com/my-nipr/frontend/user-menu')

    // Step 1: Click first btn-link button
    console.log('[NIPR] Clicking initial button...')
    const button = page.locator("//button[contains(@class, 'btn-link')]").first()
    await button.waitFor({ state: 'visible' })
    await button.click()

    // Step 2: Select NPN radio button
    await updateProgress(job.job_id, 'ENTERING_INFO')
    console.log('[NIPR] Selecting NPN radio...')
    const radioButton = page.locator("//input[@type='radio' and @value='NPN']")
    await radioButton.waitFor({ state: 'visible' })
    await radioButton.check()

    // Step 3: Check use agreement checkbox
    console.log('[NIPR] Checking agreement...')
    const checkbox = page.locator("//input[@name='useAgreementAccepted']")
    await checkbox.waitFor({ state: 'visible' })
    await checkbox.check()

    // Step 4: Fill in lastName field (from user input)
    console.log('[NIPR] Filling lastName...')
    const lastNameInput = page.locator("//input[@name='lastName']")
    await lastNameInput.waitFor({ state: 'visible' })
    await lastNameInput.fill(input.lastName)

    // Step 5: Fill in NPN field (from user input)
    console.log('[NIPR] Filling NPN...')
    const npnInput = page.locator("//input[@name='npn']")
    await npnInput.waitFor({ state: 'visible' })
    await npnInput.fill(input.npn)

    // Step 6: Click submit button
    console.log('[NIPR] Submitting lookup form...')
    const submitButton = page.locator("//li/button[@type='submit']")
    await submitButton.waitFor({ state: 'visible' })
    await submitButton.click()

    // Step 7: Fill in SSN field (from user input - last 4 digits)
    await updateProgress(job.job_id, 'VERIFYING_IDENTITY')
    console.log('[NIPR] Filling SSN...')
    const ssnInput = page.locator("//input[@name='ssn']")
    await ssnInput.waitFor({ state: 'visible' })
    await ssnInput.fill(input.ssn)

    // Step 8: Fill in DOB field (from user input)
    console.log('[NIPR] Filling DOB...')
    const dobInput = page.locator("//input[@name='dob']")
    await dobInput.waitFor({ state: 'visible' })
    await dobInput.fill(input.dob)

    // Step 9: Click submit again
    console.log('[NIPR] Submitting verification...')
    const submitButton2 = page.locator("//li/button[@type='submit']")
    await submitButton2.waitFor({ state: 'visible' })
    await submitButton2.click()

    // Step 10: Click start-flow button
    await updateProgress(job.job_id, 'SELECTING_REPORT')
    console.log('[NIPR] Starting flow...')
    const startFlowButton = page.locator("//button[@to='/start-flow']")
    await startFlowButton.waitFor({ state: 'visible' })
    await startFlowButton.click()

    // Step 11: Select PDB Detail Report
    console.log('[NIPR] Selecting PDB Detail Report...')
    const pdbRadioLabel = page.locator("//label[text()='PDB Detail Report']")
    await pdbRadioLabel.waitFor({ state: 'visible' })
    await pdbRadioLabel.click()

    // Step 12: Click submit (third time)
    console.log('[NIPR] Submitting report selection...')
    const submitButton3 = page.locator("//li/button[@type='submit']")
    await submitButton3.waitFor({ state: 'visible' })
    await submitButton3.click()

    // Step 13: Click btn-primary button
    await updateProgress(job.job_id, 'PROCESSING_REQUEST')
    console.log('[NIPR] Proceeding to payment...')
    const primaryButton = page.locator("//button[contains(@class, 'btn-primary')]")
    await primaryButton.waitFor({ state: 'visible' })
    await primaryButton.click()

    // Step 14: Check userAccepted checkbox
    console.log('[NIPR] Accepting terms...')
    const userAcceptedCheckbox = page.locator("//input[contains(@name, 'userAccepted')]")
    await userAcceptedCheckbox.waitFor({ state: 'visible' })
    await userAcceptedCheckbox.check()

    // Step 15: Click submit (fourth time)
    const submitButton4 = page.locator("//li/button[@type='submit']")
    await submitButton4.waitFor({ state: 'visible' })
    await submitButton4.click()

    // Step 16: Click submit and pay button
    await updateProgress(job.job_id, 'CONFIRMING_DETAILS')
    console.log('[NIPR] Initiating payment...')
    const submitPayButton = page.locator("//li[contains(@class, 'next')]/button[contains(@class, 'btn-default')]")
    await submitPayButton.waitFor({ state: 'visible' })
    await submitPayButton.click()

    // Step 17: Select payment method
    console.log('[NIPR] Selecting payment method...')
    const paymentRadio = page.locator("//label[contains(@class, 'payment')]")
    await paymentRadio.waitFor({ state: 'visible' })
    await paymentRadio.click()

    // Step 18: Fill billing details (from config)
    console.log('[NIPR] Filling billing details...')
    await page.locator("//input[@id='firstName']").fill(config.billing.firstName)
    await page.locator("//input[@id='lastName']").fill(config.billing.lastName)
    await page.locator("//input[@id='viewAddress.addressLine1']").fill(config.billing.address)
    await page.locator("//input[@id='viewAddress.city']").fill(config.billing.city)
    await page.locator("//select[@id='state']").selectOption(config.billing.state)
    await page.locator("//input[@id='viewAddress.zip']").fill(config.billing.zip)

    // Phone fields
    const phone = config.billing.phone.replace(/\D/g, '')
    await page.locator("//input[@id='phone_areaCode']").fill(phone.slice(0, 3))
    await page.locator("//input[@id='phone_prefix']").fill(phone.slice(3, 6))
    await page.locator("//input[@id='phone_number']").fill(phone.slice(6, 10))

    // Step 19: Click submit (fifth time)
    console.log('[NIPR] Submitting billing...')
    const submitButton5 = page.locator("//button[@id='bNext']")
    await submitButton5.waitFor({ state: 'visible' })
    await submitButton5.click()

    // Step 20: Check userAgreement checkbox
    console.log('[NIPR] Accepting payment agreement...')
    const userAgreementCheckbox = page.locator("//input[@id='userAgreement']")
    await userAgreementCheckbox.waitFor({ state: 'visible' })
    await userAgreementCheckbox.check()

    // Step 21: Fill Stripe payment details (from config)
    console.log('[NIPR] Filling payment details...')

    // Card Number (in iframe)
    const cardNumberFrame = page.frameLocator("iframe[title='Secure card number input frame']")
    await cardNumberFrame.locator("input[name='cardnumber']").fill(config.payment.cardNumber)

    // Expiry (in iframe)
    const cardExpiryFrame = page.frameLocator("iframe[title='Secure expiration date input frame']")
    await cardExpiryFrame.locator("input[name='exp-date']").fill(config.payment.expiry)

    // CVC (in iframe)
    const cardCvcFrame = page.frameLocator("iframe[title='Secure CVC input frame']")
    await cardCvcFrame.locator("input[name='cvc']").fill(config.payment.cvc)

    // Step 22: Click payment submit
    await updateProgress(job.job_id, 'FINALIZING_REQUEST')
    console.log('[NIPR] Submitting payment...')
    const paymentSubmitButton = page.locator("//button[@id='next']")
    await paymentSubmitButton.waitFor({ state: 'visible' })
    await paymentSubmitButton.click()

    // Wait for payment to process
    console.log('[NIPR] Processing payment...')
    await page.waitForTimeout(3000)

    // Step 23: Download Detail Report
    await updateProgress(job.job_id, 'DOWNLOADING_REPORT')
    console.log('[NIPR] Downloading report...')
    const detailButton = page.locator("//span[text()='View Detail']/ancestor::button")
    await detailButton.waitFor({ state: 'visible' })

    const [reportDownload] = await Promise.all([
      page.waitForEvent('download'),
      detailButton.click()
    ])

    // Use unique requestId to prevent file collisions between concurrent users
    const reportPath = path.join(downloadsFolder, `report_${requestId}.pdf`)
    await reportDownload.saveAs(reportPath)
    console.log(`[NIPR] Report saved: ${reportPath}`)

    // Close browser
    await browser.close()
    browser = null

    const files = [
      `/nipr-downloads/report_${requestId}.pdf`
    ]

    console.log('[NIPR] PDFs downloaded successfully!')

    // Run AI analysis if enabled
    let analysis: NIPRAnalysisResult | undefined

    if (config.analyzeWithAI && config.anthropicApiKey) {
      await updateProgress(job.job_id, 'ANALYZING_REPORT')
      console.log('[NIPR] Running AI analysis on report...')
      try {
        analysis = await analyzePDFReport(reportPath)
        if (analysis.success) {
          console.log(`[NIPR] AI analysis complete. Found ${analysis.unique_carriers.length} carriers.`)
        } else {
          console.log('[NIPR] AI analysis returned no results.')
        }
      } catch (error) {
        console.error('[NIPR] AI analysis error:', error)
      }
    } else {
      console.log('[NIPR] AI analysis skipped (not configured).')
    }

    await updateProgress(job.job_id, 'COMPLETE')
    console.log('[NIPR] Automation completed successfully!')

    return {
      success: true,
      message: 'NIPR automation completed successfully! PDFs downloaded.',
      files,
      analysis,
    }

  } catch (error) {
    console.error('[NIPR] Automation error:', error)

    if (browser) {
      await browser.close()
    }

    return {
      success: false,
      message: 'NIPR automation failed',
      files: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Legacy function for backwards compatibility
 * Now just executes directly (queue is handled at the API level)
 */
export async function runNIPRAutomation(input: NIPRInput): Promise<NIPRResult> {
  const jobData: NIPRJobData = {
    job_id: `legacy-${generateRequestId()}`,
    job_user_id: '',
    job_last_name: input.lastName,
    job_npn: input.npn,
    job_ssn_last4: input.ssn,
    job_dob: input.dob
  }
  return executeNIPRAutomation(jobData)
}
