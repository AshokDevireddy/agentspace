/**
 * NIPR Automation Service
 * Browser automation for retrieving PDB Detail Reports from nipr.com
 *
 * Uses HyperAgent for AI-powered local browser automation
 */

import { HyperAgent } from '@hyperbrowser/agent'
import { createAnthropicClient } from '@hyperbrowser/agent/llm/providers'
import { Hyperbrowser } from '@hyperbrowser/sdk'
import type { SessionDetail } from '@hyperbrowser/sdk/types'
import AdmZip from 'adm-zip'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import type { NIPRInput, NIPRResult, NIPRConfig, NIPRAnalysisResult } from './types'
import { analyzePDFReport } from './pdf-analyzer'
import { createAdminClient } from '@/lib/supabase/server'
import { getBrowserQueueManager } from './browser-queue-manager'

// Progress steps with percentages and messages
const PROGRESS_STEPS = {
  STARTING: { progress: 0, message: 'Starting verification...' },
  BROWSER_LAUNCH: { progress: 5, message: 'Launching browser...' },
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
 * Update job progress in the database via Django API
 */
async function updateProgress(jobId: string, step: keyof typeof PROGRESS_STEPS): Promise<void> {
  if (!jobId || jobId.startsWith('legacy-')) {
    // Skip progress updates for legacy jobs without database tracking
    return
  }

  const { progress, message } = PROGRESS_STEPS[step]

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
    const response = await fetch(`${apiUrl}/api/nipr/job-progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({
        job_id: jobId,
        progress,
        message
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[NIPR] Failed to update progress:', errorData)
    }
  } catch (error) {
    // Non-blocking - just log the error
    console.error('[NIPR] Failed to update progress:', error)
  }
}


/**
 * Mark job as failed with error message
 */
async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
  if (!jobId || jobId.startsWith('legacy-')) {
    return
  }

  try {
    const supabase = createAdminClient()
    await supabase
      .from('nipr_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
  } catch (error) {
    console.error('[NIPR] Failed to mark job as failed:', error)
  }
}

/**
 * Wait for URL to match a pattern (replacement for Playwright's waitForURL)
 * @param page - The page object
 * @param pattern - URL pattern to match (supports ** wildcards)
 * @param options - Timeout options
 */
async function waitForURLPattern(
  page: { url: () => string },
  pattern: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 30000
  const startTime = Date.now()

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
  const regex = new RegExp(regexPattern)

  while (Date.now() - startTime < timeout) {
    const currentUrl = page.url()
    if (regex.test(currentUrl)) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error(`Timeout waiting for URL pattern: ${pattern}`)
}

/**
 * Simple delay function
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}


/**
 * Wait for a regular locator element to be visible
 * Uses polling for reliability
 */
async function waitForLocatorVisible(
  page: { locator: (selector: string) => any },
  selector: string,
  options: { timeout?: number; pollInterval?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 30000
  const pollInterval = options.pollInterval || 500
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const element = page.locator(selector)
      if (await element.isVisible()) {
        return
      }
    } catch (e) {
      // Element not found yet, continue polling
    }
    await delay(pollInterval)
  }

  throw new Error(`Timeout waiting for locator element: ${selector}`)
}

/**
 * Check for NIPR error messages on the page
 * Uses multiple detection strategies: CSS selectors, ARIA roles, and text patterns
 * Returns the error text if found, null otherwise
 */
async function checkForPageError(page: { locator: (selector: string) => any, content?: () => Promise<string> }): Promise<string | null> {
  try {
    // Strategy 1: Common error CSS selectors
    const errorSelectors = [
      '.alert-danger',
      '.alert-error',
      '.error-message',
      '.error',
      '[class*="error"]',
      '.alert.alert-warning',
      '.validation-error',
      '.form-error',
      '.field-error',
      // NIPR-specific selectors
      '.nipr-error',
      '.lookup-error',
      '[role="alert"]',
      '.toast-error',
      '.notification-error'
    ]

    for (const selector of errorSelectors) {
      try {
        const element = page.locator(selector).first()
        if (await element.isVisible({ timeout: 500 })) {
          const text = await element.textContent()
          if (text && text.trim().length > 5) { // Min length to avoid empty/icon-only elements
            const cleanText = text.trim()
            const lowerText = cleanText.toLowerCase()

            // Informational messages that should NOT be treated as errors
            const informationalPatterns = [
              'vermont adjuster license applicants',
              'common expiration date',
              'dfr.vermont.gov',
            ]

            // Filter out non-error text
            const isInformational =
              lowerText.includes('loading') ||
              lowerText.includes('please wait') ||
              informationalPatterns.some(pattern => lowerText.includes(pattern))

            if (!isInformational) {
              return cleanText
            }
          }
        }
      } catch {
        continue
      }
    }

    // Strategy 2: Look for error text patterns in page content
    try {
      // Check for common error message patterns using text locators
      const errorPatterns = [
        'not found',
        'invalid',
        'does not match',
        'unable to verify',
        'could not be found',
        'no record',
        'no matching',
        'verification failed',
        'error occurred',
        'please try again',
        'incorrect'
      ]

      for (const pattern of errorPatterns) {
        try {
          const textElement = page.locator(`text=/${pattern}/i`).first()
          if (await textElement.isVisible({ timeout: 300 })) {
            // Get the parent element's text for context
            const parentText = await textElement.evaluate((el: Element) => {
              const parent = el.closest('div, p, span, li') || el
              return parent.textContent
            })
            if (parentText && parentText.trim().length > 0) {
              return parentText.trim()
            }
          }
        } catch {
          continue
        }
      }
    } catch {
      // Text pattern search failed, continue
    }

    return null
  } catch {
    return null
  }
}

/**
 * Wait for download zip to be ready on Hyperbrowser cloud
 * @param sessionId - The Hyperbrowser session ID
 * @param timeout - Maximum time to wait in milliseconds
 * @returns The download URL
 */
async function waitForDownloadZip(sessionId: string, timeout = 30000): Promise<string> {
  const hbClient = new Hyperbrowser({ apiKey: process.env.HYPERBROWSER_API_KEY! })
  const maxRetries = Math.ceil(timeout / 2000)
  let retries = 0

  while (retries < maxRetries) {
    console.log(`[NIPR-HA] Waiting for download zip... (${retries + 1}/${maxRetries})`)
    const response = await hbClient.sessions.getDownloadsURL(sessionId)

    if (response.status === 'completed' && response.downloadsUrl) {
      return response.downloadsUrl
    }
    if (response.status === 'failed') {
      throw new Error(`Download zip failed: ${response.error}`)
    }

    await delay(2000)
    retries++
  }
  throw new Error(`Download zip not ready after ${timeout}ms`)
}

/**
 * Extract PDF from download zip and save to local file
 * @param zipUrl - URL to the downloads zip file
 * @param outputPath - Local path to save the extracted PDF
 */
async function extractPdfFromZip(zipUrl: string, outputPath: string): Promise<void> {
  const response = await fetch(zipUrl)
  const zipBuffer = Buffer.from(await response.arrayBuffer())
  const zip = new AdmZip(zipBuffer)
  const pdfEntry = zip.getEntries().find(e => e.entryName.endsWith('.pdf'))

  if (!pdfEntry) {
    throw new Error('No PDF found in downloads zip')
  }

  fs.writeFileSync(outputPath, pdfEntry.getData())
}

// Validate and load NIPR configuration from environment variables
export const getDefaultConfig = (): NIPRConfig => {
  // Required environment variables for HyperAgent
  const requiredVars = [
    'ANTHROPIC_API_KEY',
    'HYPERBROWSER_API_KEY'
  ]

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
  const missingVars = [...requiredVars, ...requiredBillingVars, ...requiredPaymentVars].filter(
    varName => !process.env[varName]
  )

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
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
 * Execute the NIPR automation using HyperAgent
 * AI-powered browser automation with local execution
 */
export async function executeNIPRAutomationHyperAgent(job: NIPRJobData): Promise<NIPRResult> {
  const config = getDefaultConfig()
  const requestId = generateRequestId()
  const queueManager = getBrowserQueueManager()

  // Create downloads folder in temp directory (Vercel filesystem is read-only except /tmp)
  const downloadsFolder = path.join(os.tmpdir(), 'nipr-downloads')
  if (!fs.existsSync(downloadsFolder)) {
    fs.mkdirSync(downloadsFolder, { recursive: true })
  }

  let agent: HyperAgent | null = null

  const input: NIPRInput = {
    lastName: job.job_last_name,
    npn: job.job_npn,
    ssn: job.job_ssn_last4,
    dob: job.job_dob
  }

  try {
    await updateProgress(job.job_id, 'STARTING')

    // Initialize HyperAgent with Anthropic Claude
    await updateProgress(job.job_id, 'BROWSER_LAUNCH')

    const llm = createAnthropicClient({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514',
    })
    // Use Hyperbrowser cloud browser (local Playwright doesn't work on Vercel)
    agent = new HyperAgent({
      llm,
      browserProvider: 'Hyperbrowser',
      hyperbrowserConfig: {
        sessionConfig: {
          saveDownloads: true,
          enableAlwaysOpenPdfExternally: true
        }
      }
    })

    // Create browser page
    const page = await agent.newPage()

    // Configure CDP download behavior for cloud browser
    const browser = await agent.initBrowser()
    const cdp = await browser.newBrowserCDPSession()
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: '/tmp/downloads',
      eventsEnabled: true,
    })

    // Register with queue manager
    queueManager.registerJob(job.job_id, agent, job.job_user_id)

    // Navigate to NIPR
    await updateProgress(job.job_id, 'NAVIGATING')
    await page.goto('https://pdb.nipr.com/my-nipr/frontend/user-menu')
    await delay(2000)

    // NIPR Website Steps - Using AI-powered page.perform() for single actions
    await updateProgress(job.job_id, 'ENTERING_INFO')

    // Step 1: Click first button to begin
    await page.perform('Click the first button to begin')

    // Step 2: Select NPN radio button
    await page.perform('Click the NPN radio button')

    // Step 3: Check use agreement checkbox
    await page.perform('Check the use agreement checkbox')

    // Step 4: Fill in lastName field
    await page.perform(`Type "${input.lastName}" into the Last Name field`)

    // Step 5: Fill in NPN field
    await page.perform(`Type "${input.npn}" into the NPN field`)

    // Step 6: Click submit button
    await page.perform('Click the Submit button')

    // Check for NPN/lookup errors before proceeding
    await delay(2000)
    const lookupError = await checkForPageError(page)
    if (lookupError) {
      throw new Error(`NIPR lookup failed: ${lookupError}`)
    }

    // Step 7-8: Fill SSN and DOB
    await updateProgress(job.job_id, 'VERIFYING_IDENTITY')
    await page.perform(`Type "${input.ssn}" into the SSN field`)

    await page.perform(`Type "${input.dob}" into the Date of Birth field`)

    // Step 9: Click submit again
    await page.perform('Click the Submit button')

    // Check for verification errors before proceeding
    await delay(2000)
    const verificationError = await checkForPageError(page)
    if (verificationError) {
      throw new Error(`Identity verification failed: ${verificationError}`)
    }

    // Step 10: Click start-flow button
    await updateProgress(job.job_id, 'SELECTING_REPORT')
    await page.perform('Click the Start Flow button')

    // Step 11: Select PDB Detail Report
    await page.perform('Click the PDB Detail Report radio button or label')

    // Step 12: Click submit (third time)
    await page.perform('Click the Next button')

    // Step 13: Click primary button
    await updateProgress(job.job_id, 'PROCESSING_REQUEST')
    await page.perform('Click the Submit Request button')

    // Step 14: Check userAccepted checkbox
    await page.perform('Check the user acceptance checkbox')

    // Step 15: Click submit (fourth time)
    await page.perform('Click the Submit button')

    // Step 16: Click submit and pay button
    await updateProgress(job.job_id, 'CONFIRMING_DETAILS')
    await page.perform('Click the Submit and Pay button')

    // Wait for billing details page
    await waitForURLPattern(page, '**/billingDetails**', { timeout: 60000 })

    // Payment Page Steps - Using AI for form filling
    await page.perform('Click the Credit Card radio button')

    // Fill billing details using config values from environment variables
    await page.perform(`Type "${config.billing.firstName}" into the First Name field`)
    await page.perform(`Type "${config.billing.lastName}" into the Last Name field`)
    await page.perform(`Type "${config.billing.address}" into the Address field`)
    await page.perform(`Type "${config.billing.city}" into the City field`)

    // Use direct Playwright for native <select> dropdown
    await page.locator('#state').selectOption(config.billing.state)

    await page.perform(`Type "${config.billing.zip}" into the ZIP field`)

    // Phone number fields - use direct Playwright locators (AI can't distinguish between similar fields)
    const phoneDigits = config.billing.phone.replace(/\D/g, '')
    const areaCode = phoneDigits.substring(0, 3)
    const prefix = phoneDigits.substring(3, 6)
    const lineNumber = phoneDigits.substring(6, 10)
    await page.locator('#phone_areaCode').fill(areaCode)
    await page.locator('#phone_prefix').fill(prefix)
    await page.locator('#phone_number').fill(lineNumber)

    // Click Next button
    await page.perform('Click the Next button')
    await delay(3000)

    // Wait for Stripe page
    await waitForURLPattern(page, '**/stripeDetails**', { timeout: 60000 })

    // Check userAgreement checkbox - this reveals the Stripe form
    await page.perform('Check the I agree checkbox')
    await delay(3000) // Wait for Stripe iframes to load

    // Fill Stripe payment details using page.perform()
    await delay(3000) // Wait for Stripe to fully load

    // Card Number
    await page.perform(`Type "${config.payment.cardNumber}" into the card number field`)

    // Expiry
    await page.perform(`Type "${config.payment.expiry}" into the expiry field`)

    // CVC
    await page.perform(`Type "${config.payment.cvc}" into the CVC field`)

    // Click payment submit
    await updateProgress(job.job_id, 'FINALIZING_REQUEST')
    await page.perform('Click the Submit button')

    // Wait for payment to process
    await delay(5000)

    // Download Detail Report
    await updateProgress(job.job_id, 'DOWNLOADING_REPORT')

    // Wait for the report page to be ready
    await delay(3000)

    // Trigger download and wait for it to complete on cloud
    // Note: With Hyperbrowser cloud, download.saveAs() doesn't work - files download to cloud's /tmp
    const downloadPromise = page.waitForEvent('download')
    await page.perform('Click the View Detail button')
    const download = await downloadPromise

    // Wait for download to complete on cloud (NOT saveAs - that doesn't work remotely)
    await download.path()

    // Get session ID before closing agent
    const session = agent.getSession() as SessionDetail
    const sessionId = session?.id
    if (!sessionId) {
      throw new Error('Could not get Hyperbrowser session ID')
    }

    // Unregister from queue manager before closing
    queueManager.unregisterJob(job.job_id)

    // Close agent (this stops the session)
    await agent.closeAgent()

    // Wait for downloads zip to be ready on Hyperbrowser cloud
    await delay(3000)
    const zipUrl = await waitForDownloadZip(sessionId)

    // Extract PDF from zip
    const reportPath = path.join(downloadsFolder, `report_${requestId}.pdf`)
    await extractPdfFromZip(zipUrl, reportPath)

    // Files are in temp directory (not publicly accessible, but analyzed immediately)
    const files = [reportPath]

    // Run AI analysis if enabled
    let analysis: NIPRAnalysisResult | undefined

    if (config.analyzeWithAI && config.anthropicApiKey) {
      await updateProgress(job.job_id, 'ANALYZING_REPORT')
      try {
        analysis = await analyzePDFReport(reportPath)
      } catch (error) {
        console.error('[NIPR-HA] AI analysis error:', error)
      }
    }

    // Clean up temp file after analysis
    try {
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath)
      }
    } catch (cleanupError) {
      console.warn('[NIPR-HA] Failed to clean up temp file:', cleanupError)
    }

    await updateProgress(job.job_id, 'COMPLETE')

    return {
      success: true,
      message: 'NIPR automation completed successfully! PDFs downloaded.',
      files,
      analysis,
    }

  } catch (error) {
    console.error('[NIPR-HA] HyperAgent automation error:', error)

    // Mark job as failed
    await markJobFailed(job.job_id, error instanceof Error ? error.message : String(error))

    // Unregister from queue manager
    queueManager.unregisterJob(job.job_id)

    // Clean up HyperAgent
    if (agent) {
      try {
        await agent.closeAgent()
      } catch (closeError) {
        console.error('[NIPR-HA] Error closing HyperAgent:', closeError)
      }
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
 * Execute the NIPR automation for a specific job
 * This is the main entry point - uses HyperAgent for local browser automation
 */
export async function executeNIPRAutomation(job: NIPRJobData): Promise<NIPRResult> {
  return executeNIPRAutomationHyperAgent(job)
}
