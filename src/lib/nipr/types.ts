/**
 * NIPR Automation Types
 * Types for the National Insurance Producer Registry automation
 */

/** Structure for unique carriers data stored in agencies table */
export interface AgencyCarriersData {
  /** Array of unique carrier names */
  carriers: string[]
  /** Number of unique carriers */
  count: number
  /** ISO timestamp of last update */
  lastUpdated: string
}

/** Input data required to run the NIPR automation */
export interface NIPRInput {
  /** Agent's last name */
  lastName: string
  /** National Producer Number */
  npn: string
  /** Last 4 digits of SSN */
  ssn: string
  /** Date of birth in MM/DD/YYYY format */
  dob: string
}

/** AI Analysis result from Claude */
export interface NIPRAnalysisResult {
  /** Whether analysis was successful */
  success: boolean
  /** List of unique carrier/company names */
  unique_carriers: string[]
  /** Licensed states information */
  licensedStates: {
    resident: string[]
    nonResident: string[]
  }
  /** Timestamp of analysis */
  analyzedAt: string
  /** Token usage for the API call */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  /** Whether carriers were successfully saved to database */
  savedToDatabase?: boolean
  /** Agency ID where carriers were saved */
  agencyId?: string
}

/** Result of the NIPR automation */
export interface NIPRResult {
  /** Whether the automation completed successfully */
  success: boolean
  /** Human-readable status message */
  message: string
  /** Paths to downloaded files (receipt, report) */
  files: string[]
  /** Structured AI analysis result */
  analysis?: NIPRAnalysisResult
  /** Error details if automation failed */
  error?: string
}

/** Billing information for NIPR payment */
export interface NIPRBillingInfo {
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
}

/** Payment card information for NIPR */
export interface NIPRPaymentInfo {
  cardNumber: string
  expiry: string
  cvc: string
}

/** Configuration for the NIPR automation */
export interface NIPRConfig {
  billing: NIPRBillingInfo
  payment: NIPRPaymentInfo
  /** Whether to run AI analysis on the report */
  analyzeWithAI: boolean
  /** Anthropic API key for AI analysis */
  anthropicApiKey?: string
}

