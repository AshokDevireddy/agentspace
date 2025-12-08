/**
 * NIPR Automation Service
 * Browser automation for retrieving PDB Detail Reports from nipr.com
 */

import { chromium, Browser, Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import type { NIPRInput, NIPRResult, NIPRConfig, NIPRAnalysisResult } from './types'
import { analyzePDFReport } from './pdf-analyzer'

// Validate and load NIPR configuration from environment variables
const getDefaultConfig = (): NIPRConfig => {
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
 * Run the NIPR automation to retrieve PDB Detail Report
 */
export async function runNIPRAutomation(input: NIPRInput): Promise<NIPRResult> {
  const config = getDefaultConfig()
  const currentDate = new Date().toISOString().split('T')[0]

  // Create downloads folder
  const downloadsFolder = path.join(process.cwd(), 'public', 'nipr-downloads')
  if (!fs.existsSync(downloadsFolder)) {
    fs.mkdirSync(downloadsFolder, { recursive: true })
  }

  let browser: Browser | null = null

  try {
    console.log('[NIPR] Starting automation...')

    // Launch browser in headless mode
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
    console.log('[NIPR] Navigating to NIPR...')
    await page.goto('https://pdb.nipr.com/my-nipr/frontend/user-menu')

    // Step 1: Click first btn-link button
    console.log('[NIPR] Clicking initial button...')
    const button = page.locator("//button[contains(@class, 'btn-link')]").first()
    await button.waitFor({ state: 'visible' })
    await button.click()

    // Step 2: Select NPN radio button
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
    console.log('[NIPR] Submitting payment...')
    const paymentSubmitButton = page.locator("//button[@id='next']")
    await paymentSubmitButton.waitFor({ state: 'visible' })
    await paymentSubmitButton.click()

    // Wait for payment to process
    console.log('[NIPR] Processing payment...')
    await page.waitForTimeout(3000)

    // Step 23: Download Receipt
    console.log('[NIPR] Downloading receipt...')
    const receiptButton = page.locator("//span[text()='View Receipt']/ancestor::button")
    await receiptButton.waitFor({ state: 'visible' })

    const [receiptDownload] = await Promise.all([
      page.waitForEvent('download'),
      receiptButton.click()
    ])

    const receiptPath = path.join(downloadsFolder, `receipt_${currentDate}.pdf`)
    await receiptDownload.saveAs(receiptPath)
    console.log(`[NIPR] Receipt saved: ${receiptPath}`)

    await page.waitForTimeout(2000)

    // Step 24: Download Detail Report
    console.log('[NIPR] Downloading report...')
    const detailButton = page.locator("//span[text()='View Detail']/ancestor::button")
    await detailButton.waitFor({ state: 'visible' })

    const [reportDownload] = await Promise.all([
      page.waitForEvent('download'),
      detailButton.click()
    ])

    const reportPath = path.join(downloadsFolder, `report_${currentDate}.pdf`)
    await reportDownload.saveAs(reportPath)
    console.log(`[NIPR] Report saved: ${reportPath}`)

    // Close browser
    await browser.close()
    browser = null

    const files = [
      `/nipr-downloads/receipt_${currentDate}.pdf`,
      `/nipr-downloads/report_${currentDate}.pdf`
    ]

    console.log('[NIPR] PDFs downloaded successfully!')

    // Run AI analysis if enabled
    let analysis: NIPRAnalysisResult | undefined

    if (config.analyzeWithAI && config.anthropicApiKey) {
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
