/**
 * PDF Analyzer Service
 * Uses LangChain with Anthropic Claude API to analyze NIPR PDB reports and extract carrier information
 */

import { ChatAnthropic } from '@langchain/anthropic'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import { PromptTemplate } from '@langchain/core/prompts'
import fs from 'fs'
import path from 'path'
import type { NIPRAnalysisResult } from './types'

// Import pdf-parse library directly (bypasses debug mode in index.js)
// @ts-ignore - importing internal module to avoid debug mode issue
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

/**
 * Get page count from a PDF file
 */
async function getPdfPageCount(pdfPath: string): Promise<number> {
  try {
    const dataBuffer = fs.readFileSync(pdfPath)
    const data = await pdfParse(dataBuffer)
    return data.numpages || 0
  } catch (error) {
    console.error('[PDF-ANALYZER] Error getting page count:', error)
    return 0
  }
}

/**
 * Extract text from a PDF file
 */
async function extractPdfText(pdfPath: string): Promise<string | null> {
  try {
    // Validate file exists and has content
    if (!fs.existsSync(pdfPath)) {
      console.error('[PDF-ANALYZER] PDF file does not exist:', pdfPath)
      return null
    }

    const stats = fs.statSync(pdfPath)
    if (stats.size === 0) {
      console.error('[PDF-ANALYZER] PDF file is empty:', pdfPath)
      return null
    }

    console.log(`[PDF-ANALYZER] Reading PDF file: ${path.basename(pdfPath)} (${(stats.size / 1024).toFixed(1)}KB)`)

    const dataBuffer = fs.readFileSync(pdfPath)
    const data = await pdfParse(dataBuffer)

    const extractedText = data.text || ''
    const textLength = extractedText.length

    if (textLength === 0) {
      console.warn('[PDF-ANALYZER] No text extracted from PDF')
      return null
    }

    console.log(`[PDF-ANALYZER] Extracted ${textLength} characters from PDF`)

    // Log first 200 characters for debugging
    const preview = extractedText.substring(0, 200).replace(/\s+/g, ' ')
    console.log(`[PDF-ANALYZER] Text preview: "${preview}..."`)

    return extractedText
  } catch (error) {
    console.error('[PDF-ANALYZER] Error extracting text:', error)
    return null
  }
}

/**
 * Create the LangChain prompt template for analysis
 */
function createAnalysisPromptTemplate(): PromptTemplate {
  return PromptTemplate.fromTemplate(`Analyze this insurance PDB (Producer Database) report and extract the following information.

{format_instructions}

Extract:
1. ALL UNIQUE insurance company/carrier names found in the document
2. Licensed states (both resident and non-resident)

Return this exact JSON structure:
{{
  "unique_carriers": ["Company Name 1", "Company Name 2", ...],
  "licensedStates": {{
    "resident": ["State Name (XX)"],
    "nonResident": ["State Name (XX)", "State Name (XX)", ...]
  }}
}}

Guidelines:
- Remove duplicate company names - only include unique carriers
- Normalize company names (e.g., "AMERICAN GENERAL LIFE INSURANCE COMPANY" → "American General Life Insurance Company")
- Include all carriers regardless of appointment status
- For states, include both the full name and abbreviation (e.g., "California (CA)")
- If no data found for a field, use an empty array []

Document content: {content}`)
}

/**
 * Create LangChain analysis chain
 */
function createAnalysisChain(model: ChatAnthropic) {
  const parser = new JsonOutputParser()
  const prompt = createAnalysisPromptTemplate()

  return prompt.pipe(model).pipe(parser)
}

/**
 * Validate and normalize analysis result
 */
function validateAnalysisResult(result: any): { unique_carriers: string[]; licensedStates: { resident: string[]; nonResident: string[] } } {
  try {
    return {
      unique_carriers: Array.isArray(result.unique_carriers) ? result.unique_carriers : [],
      licensedStates: {
        resident: Array.isArray(result.licensedStates?.resident) ? result.licensedStates.resident : [],
        nonResident: Array.isArray(result.licensedStates?.nonResident) ? result.licensedStates.nonResident : []
      }
    }
  } catch (error) {
    console.error('[PDF-ANALYZER] Error validating result:', error)
    return {
      unique_carriers: [],
      licensedStates: { resident: [], nonResident: [] }
    }
  }
}

/**
 * Extract state abbreviations from "State Name (XX)" format
 * Combines resident and non-resident states into a deduplicated array
 *
 * @param licensedStates - Object containing resident and nonResident state arrays
 * @returns Array of unique state abbreviations (e.g., ['CA', 'TX'])
 */
export function extractStateAbbreviations(
  licensedStates: { resident: string[]; nonResident: string[] }
): string[] {
  const allStates = [...licensedStates.resident, ...licensedStates.nonResident]

  const abbreviations = allStates
    .map(state => {
      // Extract abbreviation from "State Name (XX)" format
      const match = state.match(/\(([A-Z]{2})\)$/)
      return match ? match[1] : null
    })
    .filter((abbr): abbr is string => abbr !== null)

  // Return deduplicated array
  return [...new Set(abbreviations)]
}

/**
 * Analyze a PDF report using text extraction with LangChain (for PDFs <= 100 pages)
 * Note: LangChain ChatAnthropic doesn't support document API, so we extract text first
 */
async function analyzeWithDocumentAPI(
  chatModel: ChatAnthropic,
  pdfPath: string
): Promise<NIPRAnalysisResult> {
  console.log('[PDF-ANALYZER] Using text extraction for analysis (LangChain approach)...')

  // Extract text from PDF since LangChain doesn't support document API directly
  const pdfText = await extractPdfText(pdfPath)

  if (!pdfText || pdfText.trim().length === 0) {
    console.error('[PDF-ANALYZER] No valid text content extracted from PDF')
    return {
      success: false,
      unique_carriers: [],
      unique_states: [],
      licensedStates: { resident: [], nonResident: [] },
      analyzedAt: new Date().toISOString()
    }
  }

  // Validate text length is reasonable for analysis
  if (pdfText.length < 100) {
    console.warn(`[PDF-ANALYZER] PDF text is very short (${pdfText.length} chars), may not contain carrier data`)
  }

  try {
    const parser = new JsonOutputParser()
    const chain = createAnalysisChain(chatModel)

    const result = await chain.invoke({
      content: pdfText,
      format_instructions: parser.getFormatInstructions()
    })

    const validated = validateAnalysisResult(result)

    console.log(`[PDF-ANALYZER] Found ${validated.unique_carriers.length} unique carriers`)

    return {
      success: true,
      unique_carriers: validated.unique_carriers,
      unique_states: extractStateAbbreviations(validated.licensedStates),
      licensedStates: validated.licensedStates,
      analyzedAt: new Date().toISOString()
      // Note: LangChain doesn't expose token usage in the same way
    }
  } catch (error) {
    console.error('[PDF-ANALYZER] LangChain analysis error:', error)
    return {
      success: false,
      unique_carriers: [],
      unique_states: [],
      licensedStates: { resident: [], nonResident: [] },
      analyzedAt: new Date().toISOString()
    }
  }
}

/**
 * Analyze a PDF report using text extraction with LangChain (for PDFs > 100 pages)
 */
async function analyzeWithTextExtraction(
  chatModel: ChatAnthropic,
  pdfPath: string
): Promise<NIPRAnalysisResult> {
  console.log('[PDF-ANALYZER] Extracting text for analysis (large PDF)...')

  const pdfText = await extractPdfText(pdfPath)

  if (!pdfText) {
    return {
      success: false,
      unique_carriers: [],
      unique_states: [],
      licensedStates: { resident: [], nonResident: [] },
      analyzedAt: new Date().toISOString()
    }
  }

  console.log(`[PDF-ANALYZER] Extracted ${pdfText.length} characters`)

  try {
    const parser = new JsonOutputParser()
    const chain = createAnalysisChain(chatModel)

    const result = await chain.invoke({
      content: pdfText,
      format_instructions: parser.getFormatInstructions()
    })

    const validated = validateAnalysisResult(result)

    console.log(`[PDF-ANALYZER] Found ${validated.unique_carriers.length} unique carriers`)

    return {
      success: true,
      unique_carriers: validated.unique_carriers,
      unique_states: extractStateAbbreviations(validated.licensedStates),
      licensedStates: validated.licensedStates,
      analyzedAt: new Date().toISOString()
      // Note: LangChain doesn't expose token usage in the same way
    }
  } catch (error) {
    console.error('[PDF-ANALYZER] LangChain analysis error:', error)
    return {
      success: false,
      unique_carriers: [],
      unique_states: [],
      licensedStates: { resident: [], nonResident: [] },
      analyzedAt: new Date().toISOString()
    }
  }
}

/**
 * Analyze a PDF report and extract carrier information using LangChain
 *
 * @param pdfPath - Path to the PDF file to analyze
 * @returns Analysis result with unique carriers and licensed states
 */
export async function analyzePDFReport(pdfPath: string): Promise<NIPRAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
  const maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10)

  if (!apiKey) {
    console.error('[PDF-ANALYZER] ANTHROPIC_API_KEY not set')
    return {
      success: false,
      unique_carriers: [],
      unique_states: [],
      licensedStates: { resident: [], nonResident: [] },
      analyzedAt: new Date().toISOString()
    }
  }

  if (!fs.existsSync(pdfPath)) {
    console.error('[PDF-ANALYZER] PDF file not found:', pdfPath)
    return {
      success: false,
      unique_carriers: [],
      unique_states: [],
      licensedStates: { resident: [], nonResident: [] },
      analyzedAt: new Date().toISOString()
    }
  }

  try {
    console.log(`[PDF-ANALYZER] Analyzing PDF: ${path.basename(pdfPath)}`)

    // Create LangChain ChatAnthropic model
    const chatModel = new ChatAnthropic({
      anthropicApiKey: apiKey,
      modelName: model,
      maxTokens: maxTokens,
    })

    // Check page count
    const pageCount = await getPdfPageCount(pdfPath)
    console.log(`[PDF-ANALYZER] PDF has ${pageCount} pages`)

    let result: NIPRAnalysisResult

    if (pageCount > 100) {
      // For large PDFs, extract text first
      result = await analyzeWithTextExtraction(chatModel, pdfPath)
    } else {
      // For smaller PDFs, use text extraction (LangChain approach)
      result = await analyzeWithDocumentAPI(chatModel, pdfPath)
    }

    console.log(`[PDF-ANALYZER] Analysis complete. Found ${result.unique_carriers.length} unique carriers.`)
    return result

  } catch (error) {
    console.error('[PDF-ANALYZER] Analysis error:', error)
    return {
      success: false,
      unique_carriers: [],
      unique_states: [],
      licensedStates: { resident: [], nonResident: [] },
      analyzedAt: new Date().toISOString()
    }
  }
}
