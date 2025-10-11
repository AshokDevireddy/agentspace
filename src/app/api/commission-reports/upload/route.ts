import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CommissionReportData {
  loaContract: string
  agentPayroll: string | null
  date: string
  amount: string
  paymentIdentifier: string
  leadFeePercentage: string
  carrierId: string
  userId?: string
  agencyId?: string | null
}

// Carrier-specific CSV column configurations
interface CarrierColumnMapping {
  company?: string
  commissionType?: string
  writingAgentNumber: string
  writingAgentName?: string
  clientName: string
  policyNumber: string
  commissionCategory?: string
  appDate?: string
  state?: string
  product?: string
  effectiveDate?: string
  premiumDueDate?: string
  commissionablePremium: string
  splitPercentage?: string
  commissionRate?: string
  monthsAdvanced?: string
  commissionAmount: string
  paymentMode?: string
  replacementPolicyEffectiveDate?: string
  commissionPaidDate?: string
  longDescription?: string
}

interface CarrierConfig {
  name: string
  fileType: 'csv' | 'excel' // Type of file expected
  excelSheetName?: string // Sheet name for Excel files (required if fileType is 'excel')
  columnMapping: CarrierColumnMapping
  dateFormat?: string // Optional custom date format
  currencySymbol?: string // Default is '$'
  requiredColumns: string[] // Columns that must exist for valid records
  skipHeaderRows?: number // Number of header rows to skip (default 0)
}

// Carrier configurations - easily extensible for new carriers
const CARRIER_CONFIGS: Record<string, CarrierConfig> = {
  'Aetna': {
    name: 'Aetna',
    fileType: 'excel',
    excelSheetName: 'Commission Details',
    columnMapping: {
      company: 'COMPANY',
      commissionType: 'COMMISSIONTYPE',
      writingAgentNumber: 'WRITINGAGENTNUMBER',
      writingAgentName: 'WRITINGAGENTNAME',
      clientName: 'CLIENT',
      policyNumber: 'POLICYNUMBER',
      commissionCategory: 'COMMISSIONCATEGORY',
      appDate: 'APPDATE',
      state: 'STATE',
      product: 'PRODUCT',
      effectiveDate: 'EFFECTIVEDATE',
      premiumDueDate: 'PREMIUMDUEDATE',
      commissionablePremium: 'COMMISSIONABLEPREMIUM',
      splitPercentage: 'SPLIT%',
      commissionRate: 'RATE%',
      monthsAdvanced: 'MONTHSADVANCED',
      commissionAmount: 'COMMISSIONAMOUNT',
      paymentMode: 'MODE',
      replacementPolicyEffectiveDate: 'REPLPOLEFFDATE',
      commissionPaidDate: 'COMMISSIONPAIDDATE',
      longDescription: 'LONGDESCRIPTION'
    },
    requiredColumns: ['WRITINGAGENTNUMBER', 'COMMISSIONABLEPREMIUM', 'CLIENT', 'POLICYNUMBER'],
    currencySymbol: '$'
  },

  'Aflac': {
    name: 'Aflac',
    fileType: 'csv',
    columnMapping: {
      writingAgentNumber: 'AGENT_NUMBER',
      writingAgentName: 'AGENT_NAME',
      clientName: 'POLICY_HOLDER',
      policyNumber: 'POLICY_NUM',
      commissionablePremium: 'PREMIUM_AMOUNT',
      commissionAmount: 'COMMISSION_AMT',
      effectiveDate: 'EFFECTIVE_DT',
      commissionPaidDate: 'PAID_DATE',
      product: 'PRODUCT_NAME'
    },
    requiredColumns: ['AGENT_NUMBER', 'PREMIUM_AMOUNT', 'POLICY_HOLDER', 'POLICY_NUM'],
    currencySymbol: '$'
  },

  'American Amicable / Occidental': {
    name: 'American Amicable / Occidental',
    fileType: 'csv',
    columnMapping: {
      writingAgentNumber: 'WritingAgentID',
      writingAgentName: 'AgentName',
      clientName: 'ClientName',
      policyNumber: 'PolicyNumber',
      commissionablePremium: 'Premium',
      commissionAmount: 'CommissionPaid',
      effectiveDate: 'PolicyEffectiveDate',
      commissionPaidDate: 'CommissionDate',
      product: 'ProductName',
      commissionCategory: 'CommissionType'
    },
    requiredColumns: ['WritingAgentID', 'Premium', 'ClientName', 'PolicyNumber'],
    currencySymbol: '$'
  },

  'Foresters Financial': {
    name: 'Foresters Financial',
    fileType: 'csv',
    columnMapping: {
      writingAgentNumber: 'Agent_Code',
      writingAgentName: 'Agent_Full_Name',
      clientName: 'Insured_Name',
      policyNumber: 'Certificate_Number',
      commissionablePremium: 'Annual_Premium',
      commissionAmount: 'Commission_Amount',
      effectiveDate: 'Issue_Date',
      commissionPaidDate: 'Payment_Date',
      product: 'Plan_Name'
    },
    requiredColumns: ['Agent_Code', 'Annual_Premium', 'Insured_Name', 'Certificate_Number'],
    currencySymbol: '$'
  },

  'Baltimore Life': {
    name: 'Baltimore Life',
    fileType: 'csv',
    columnMapping: {
      writingAgentNumber: 'AGENT_NO',
      writingAgentName: 'AGENT_NAME',
      clientName: 'INSURED_NAME',
      policyNumber: 'POLICY_NO',
      commissionablePremium: 'PREMIUM',
      commissionAmount: 'COMM_AMT',
      effectiveDate: 'EFF_DATE',
      commissionPaidDate: 'COMM_DATE',
      product: 'PLAN_CODE'
    },
    requiredColumns: ['AGENT_NO', 'PREMIUM', 'INSURED_NAME', 'POLICY_NO'],
    currencySymbol: '$'
  },

  'Guarantee Trust Life (GTL)': {
    name: 'Guarantee Trust Life (GTL)',
    fileType: 'csv',
    columnMapping: {
      writingAgentNumber: 'AgentNumber',
      writingAgentName: 'AgentName',
      clientName: 'PolicyholderName',
      policyNumber: 'PolicyNumber',
      commissionablePremium: 'AnnualPremium',
      commissionAmount: 'CommissionAmount',
      effectiveDate: 'EffectiveDate',
      commissionPaidDate: 'CommissionDate',
      product: 'ProductCode'
    },
    requiredColumns: ['AgentNumber', 'AnnualPremium', 'PolicyholderName', 'PolicyNumber'],
    currencySymbol: '$'
  },

  'Royal Neighbors of America (RNA)': {
    name: 'Royal Neighbors of America (RNA)',
    fileType: 'csv',
    columnMapping: {
      writingAgentNumber: 'Rep_Number',
      writingAgentName: 'Rep_Name',
      clientName: 'Member_Name',
      policyNumber: 'Certificate_No',
      commissionablePremium: 'Premium_Amount',
      commissionAmount: 'Commission_Paid',
      effectiveDate: 'Certificate_Date',
      commissionPaidDate: 'Paid_Date',
      product: 'Product_Description'
    },
    requiredColumns: ['Rep_Number', 'Premium_Amount', 'Member_Name', 'Certificate_No'],
    currencySymbol: '$'
  },

  'Liberty Bankers Life (LBL)': {
    name: 'Liberty Bankers Life (LBL)',
    fileType: 'csv',
    columnMapping: {
      writingAgentNumber: 'AGENT_CODE',
      writingAgentName: 'AGENT_NAME',
      clientName: 'OWNER_NAME',
      policyNumber: 'POLICY_NUMBER',
      commissionablePremium: 'PREMIUM_AMT',
      commissionAmount: 'COMMISSION_AMT',
      effectiveDate: 'ISSUE_DATE',
      commissionPaidDate: 'COMM_PAID_DATE',
      product: 'PRODUCT_NAME'
    },
    requiredColumns: ['AGENT_CODE', 'PREMIUM_AMT', 'OWNER_NAME', 'POLICY_NUMBER'],
    currencySymbol: '$'
  }
}

// Generic CSV record type - will be mapped from carrier-specific columns
interface StandardizedRecord {
  company?: string
  commissionType?: string
  writingAgentNumber: string
  writingAgentName?: string
  clientName: string
  policyNumber: string
  commissionCategory?: string
  appDate?: string
  state?: string
  product?: string
  effectiveDate?: string
  premiumDueDate?: string
  commissionablePremium: string
  splitPercentage?: string
  commissionRate?: string
  monthsAdvanced?: string
  commissionAmount: string
  paymentMode?: string
  replacementPolicyEffectiveDate?: string
  commissionPaidDate?: string
  longDescription?: string
}

interface Agent {
  id: string
  upline_id: string | null
  position_id: string
  first_name: string
  last_name: string
}

interface CommissionStructure {
  percentage: number
  commission_type: string
  level: number
}

// --- NEW HELPER FUNCTIONS FOR DATE CONVERSION ---

// Converts Excel serial date numbers to JavaScript Date objects.
function convertExcelDate(excelSerial: any): Date | null {
  if (!excelSerial || typeof excelSerial !== 'number') {
    // Attempt to parse if it's already a date-like string
    const d = new Date(excelSerial);
    if (d instanceof Date && !isNaN(d.getTime())) {
        return d;
    }
    return null;
  }
  // The conversion is based on days since 1900-01-01, adjusted for epoch difference and Excel's leap year bug.
  // 25569 is the number of days between 1900-01-01 and 1970-01-01.
  const jsDate = new Date((excelSerial - 25569) * 86400 * 1000);
  // Check for invalid date result
  if (isNaN(jsDate.getTime())) {
    return null;
  }
  return jsDate;
}

// Formats a JavaScript Date object into 'YYYY-MM-DD' string for Supabase.
function formatDateForSupabase(date: Date | null): string | null {
    if (!date) return null;
    return date.toISOString().split('T')[0];
}

// Helper function to parse currency values
function parseCurrencyValue(value: string, currencySymbol: string = '$'): number {
  if (!value) return 0
  return parseFloat(value.replace(currencySymbol, '').replace(/,/g, '').trim()) || 0
}

// Helper function to parse Excel file and extract data from specific sheet
async function parseExcelFile(file: File, sheetName: string): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  // Check if the specified sheet exists
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`)
  }

  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Get raw data first
    defval: '' // Default value for empty cells
  }) as any[][]

  if (jsonData.length === 0) {
    throw new Error(`Sheet "${sheetName}" is empty`)
  }

  // Convert to object format with first row as headers
  const headers = jsonData[0]
  const records: Record<string, any>[] = []

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    const record: Record<string, any> = {}

    headers.forEach((header, index) => {
      if (header && header.trim()) {
        const cellValue = row[index];
        // Keep numbers as numbers for date parsing, trim strings
        record[header.trim()] = typeof cellValue === 'string' ? cellValue.trim() : cellValue;
      }
    })

    // Only add non-empty records
    if (Object.keys(record).length > 0 && Object.values(record).some(val => val !== '')) {
      records.push(record)
    }
  }

  return records
}

// Helper function to parse CSV file
async function parseCSVFile(file: File): Promise<Record<string, string>[]> {
  const fileText = await file.text()
  const csvData = Papa.parse(fileText, {
    header: true,
    skipEmptyLines: true,
    transform: (value: string) => value.trim()
  })

  if (csvData.errors.length > 0) {
    throw new Error(`CSV parsing error: ${csvData.errors.map(e => e.message).join(', ')}`)
  }

  return csvData.data as Record<string, string>[]
}

// Helper function to standardize records based on carrier configuration
function standardizeRecord(rawRecord: Record<string, any>, config: CarrierConfig): StandardizedRecord | null {
  const mapping = config.columnMapping

  // Check if required columns exist
  for (const requiredCol of config.requiredColumns) {
    const value = rawRecord[requiredCol];
    if (value === null || value === undefined) {
      return null; // Skip if null or undefined
    }
    // If it's a string, also check if it's empty after trimming
    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }
  }

  const standardized: StandardizedRecord = {
    writingAgentNumber: rawRecord[mapping.writingAgentNumber]?.toString().trim() || '',
    clientName: rawRecord[mapping.clientName]?.toString().trim() || '',
    policyNumber: rawRecord[mapping.policyNumber]?.toString().trim() || '',
    commissionablePremium: rawRecord[mapping.commissionablePremium]?.toString().trim() || '0',
    commissionAmount: rawRecord[mapping.commissionAmount]?.toString().trim() || '0'
  }

  // Map optional fields
  if (mapping.company && rawRecord[mapping.company]) {
    standardized.company = rawRecord[mapping.company].toString().trim()
  }
  if (mapping.commissionType && rawRecord[mapping.commissionType]) {
    standardized.commissionType = rawRecord[mapping.commissionType].toString().trim()
  }
  if (mapping.writingAgentName && rawRecord[mapping.writingAgentName]) {
    standardized.writingAgentName = rawRecord[mapping.writingAgentName].toString().trim()
  }
  if (mapping.commissionCategory && rawRecord[mapping.commissionCategory]) {
    standardized.commissionCategory = rawRecord[mapping.commissionCategory].toString().trim()
  }
  if (mapping.appDate && rawRecord[mapping.appDate]) {
    const date = convertExcelDate(rawRecord[mapping.appDate]);
    standardized.appDate = formatDateForSupabase(date) || undefined;
  }
  if (mapping.state && rawRecord[mapping.state]) {
    standardized.state = rawRecord[mapping.state].toString().trim()
  }
  if (mapping.product && rawRecord[mapping.product]) {
    standardized.product = rawRecord[mapping.product].toString().trim()
  }
  if (mapping.effectiveDate && rawRecord[mapping.effectiveDate]) {
    const date = convertExcelDate(rawRecord[mapping.effectiveDate]);
    standardized.effectiveDate = formatDateForSupabase(date) || undefined;
  }
  if (mapping.premiumDueDate && rawRecord[mapping.premiumDueDate]) {
    const date = convertExcelDate(rawRecord[mapping.premiumDueDate]);
    standardized.premiumDueDate = formatDateForSupabase(date) || undefined;
  }
  if (mapping.splitPercentage && rawRecord[mapping.splitPercentage]) {
    standardized.splitPercentage = rawRecord[mapping.splitPercentage].toString().trim()
  }
  if (mapping.commissionRate && rawRecord[mapping.commissionRate]) {
    standardized.commissionRate = rawRecord[mapping.commissionRate].toString().trim()
  }
  if (mapping.monthsAdvanced && rawRecord[mapping.monthsAdvanced]) {
    standardized.monthsAdvanced = rawRecord[mapping.monthsAdvanced].toString().trim()
  }
  if (mapping.paymentMode && rawRecord[mapping.paymentMode]) {
    standardized.paymentMode = rawRecord[mapping.paymentMode].toString().trim()
  }
  if (mapping.replacementPolicyEffectiveDate && rawRecord[mapping.replacementPolicyEffectiveDate]) {
    const date = convertExcelDate(rawRecord[mapping.replacementPolicyEffectiveDate]);
    standardized.replacementPolicyEffectiveDate = formatDateForSupabase(date) || undefined;
  }
  if (mapping.commissionPaidDate && rawRecord[mapping.commissionPaidDate]) {
    const date = convertExcelDate(rawRecord[mapping.commissionPaidDate]);
    standardized.commissionPaidDate = formatDateForSupabase(date) || undefined;
  }
  if (mapping.longDescription && rawRecord[mapping.longDescription]) {
    standardized.longDescription = rawRecord[mapping.longDescription].toString().trim()
  }

  return standardized
}

export async function POST(request: NextRequest) {
  try {
        console.log('=== Commission Report Upload Started ===')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const dataString = formData.get('data') as string

    console.log('Request data:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      hasDataString: !!dataString
    })

    if (!file || !dataString) {
      console.error('Missing required data:', { hasFile: !!file, hasDataString: !!dataString })
      return NextResponse.json({
        error: 'Missing file or data',
        details: { hasFile: !!file, hasDataString: !!dataString }
      }, { status: 400 })
    }

    let reportData: CommissionReportData
    try {
      reportData = JSON.parse(dataString)
      console.log('Parsed report data:', reportData)
    } catch (parseError) {
      console.error('Failed to parse data string:', parseError)
      return NextResponse.json({
        error: 'Invalid data format',
        details: parseError instanceof Error ? parseError.message : 'JSON parse error'
      }, { status: 400 })
    }

        // Extract user information from the parsed request data
    // This comes from the authenticated frontend user
    const userId = reportData.userId || null
    const agencyId = reportData.agencyId || null

    console.log('=== API: User Info Processing ===')
    console.log('Raw reportData userId:', reportData.userId)
    console.log('Raw reportData agencyId:', reportData.agencyId)
    console.log('Processed userId:', userId)
    console.log('Processed agencyId:', agencyId)
    console.log('Full reportData object:', reportData)

    // Get carrier information using name lookup (case-insensitive)
    console.log('Looking up carrier:', reportData.carrierId)

    const { data: carriers, error: carrierError } = await supabase
      .from('carriers')
      .select('id, name')
      .ilike('name', reportData.carrierId)
      .single()

    console.log('Carrier lookup result:', { carriers, carrierError })

    if (carrierError || !carriers) {
      console.error('Carrier lookup failed:', {
        searchTerm: reportData.carrierId,
        error: carrierError
      })
      return NextResponse.json({
        error: 'Invalid carrier selected',
        details: {
          searchTerm: reportData.carrierId,
          supabaseError: carrierError
        }
      }, { status: 400 })
    }

            // Get agency info if we have an agencyId, otherwise use defaults
    let agency
    if (agencyId) {
      // Optionally fetch agency details from database
      agency = { code: 'user-agency', name: 'User Agency' }
    } else {
      agency = { code: 'no-agency', name: 'No Agency' }
    }

    // Get carrier configuration using uppercase carrier name
    const carrierConfig = CARRIER_CONFIGS[carriers.name]
    if (!carrierConfig) {
      return NextResponse.json({
        error: 'Unsupported carrier',
        details: `No configuration found for carrier: ${reportData.carrierId}. Supported carriers: ${Object.keys(CARRIER_CONFIGS).join(', ')}`
      }, { status: 400 })
    }

    // Validate file type matches carrier expectation
    const fileExtension = file.name.toLowerCase().split('.').pop()
    const isExcelFile = ['xlsx', 'xls'].includes(fileExtension || '')
    const isCSVFile = fileExtension === 'csv'

    if (carrierConfig.fileType === 'excel' && !isExcelFile) {
      return NextResponse.json({
        error: 'Invalid file type',
        details: `${carrierConfig.name} requires an Excel file (.xlsx or .xls), but received a ${fileExtension} file.`
      }, { status: 400 })
    }

    if (carrierConfig.fileType === 'csv' && !isCSVFile) {
      return NextResponse.json({
        error: 'Invalid file type',
        details: `${carrierConfig.name} requires a CSV file, but received a ${fileExtension} file.`
      }, { status: 400 })
    }

    // Parse file based on carrier configuration
    let rawRecords: Record<string, any>[]

    try {
      if (carrierConfig.fileType === 'excel') {
        rawRecords = await parseExcelFile(file, carrierConfig.excelSheetName!)
      } else {
        rawRecords = await parseCSVFile(file)
      }
    } catch (parseError) {
      return NextResponse.json({
        error: 'File parsing error',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 400 })
    }

    // Standardize records using carrier-specific mapping
    const standardizedRecords: StandardizedRecord[] = []

    for (const rawRecord of rawRecords) {
      const standardized = standardizeRecord(rawRecord, carrierConfig)
      if (standardized) {
        // Additional validation for commissionable premium
        const premium = parseCurrencyValue(standardized.commissionablePremium, carrierConfig.currencySymbol)
        if (premium > 0) {
          standardizedRecords.push(standardized)
        }
      }
    }

    if (standardizedRecords.length === 0) {
      return NextResponse.json({
        error: 'No valid records found',
        details: `Please check that your ${carrierConfig.fileType.toUpperCase()} file matches the expected format for ${carrierConfig.name}${carrierConfig.fileType === 'excel' ? ` (sheet: "${carrierConfig.excelSheetName}")` : ''}`
      }, { status: 400 })
    }

    // --- Corrected Supabase Storage Path ---
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedCarrierName = carriers.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()

    // Use agencyId for the folder structure, with a fallback for unassigned uploads
    const agencyPath = agencyId || 'unassigned'

    // The bucket is 'commission-reports', so the path inside it should not repeat that.
    const storagePath = `uploads/${agencyPath}/${sanitizedCarrierName}/${timestamp}-${file.name}`

    console.log(`[Upload] Attempting to upload file to storage path: ${storagePath}`)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('commission-reports')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('File upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
    }

    // Create commission report record with file storage info
    const reportInsertData: any = {
      carrier_id: carriers.id,
      report_name: file.name,
      original_filename: file.name,
      file_path: storagePath,
      file_size: file.size,
      file_type: file.type,
      upload_date: reportData.date,
      total_amount: parseFloat(reportData.amount) || 0,
      record_count: standardizedRecords.length,
      status: 'uploaded'
    }

    // Only add agency_id and uploaded_by if they have valid values
    console.log('=== API: Building Insert Data ===')
    console.log('AgencyId available:', !!agencyId, agencyId)
    console.log('UserId available:', !!userId, userId)

    if (agencyId) {
      console.log('Adding agency_id to insert data:', agencyId)
      reportInsertData.agency_id = agencyId
    } else {
      console.log('No agencyId provided, skipping agency_id field')
    }

    if (userId) {
      console.log('Adding uploaded_by to insert data:', userId)
      reportInsertData.uploaded_by = userId
    } else {
      console.log('No userId provided, skipping uploaded_by field')
    }

    console.log('Final commission report insert data:', reportInsertData)

    const { data: commissionReport, error: reportError } = await supabase
      .from('commission_reports')
      .insert(reportInsertData)
      .select()
      .single()

    if (reportError) {
      console.error('Commission report creation failed:', reportError)
      console.error('Insert data was:', reportInsertData)
      return NextResponse.json({
        error: 'Failed to create commission report',
        details: {
          supabaseError: reportError,
          insertData: reportInsertData,
          carrierInfo: carriers,
          agencyId: agencyId
        }
      }, { status: 500 })
    }

    console.log('Commission report created successfully:', commissionReport)

    // Process each standardized record (without storing in commission_report_details)
    let processedCount = 0
    let errorCount = 0
    const commissionTransactions: any[] = []
    const processingErrors: string[] = []

    console.log(`\n=== [Processing] Starting to process ${standardizedRecords.length} standardized records ===`)

    for (const [index, record] of standardizedRecords.entries()) {
      console.log(`\n[Record #${index + 1}] Processing record:`, record)

      try {
        // Parse amounts using carrier-specific currency symbol
        const commissionablePremium = parseCurrencyValue(record.commissionablePremium, carrierConfig.currencySymbol)
        const commissionAmount = parseCurrencyValue(record.commissionAmount, carrierConfig.currencySymbol)

        // Skip if no commissionable premium
        if (commissionablePremium === 0) {
          console.log(`[Record #${index + 1}] Skipping: Commissionable premium is zero.`)
          continue
        }

        console.log(`[Record #${index + 1}] Parsed Amounts: Premium = ${commissionablePremium}, Commission = ${commissionAmount}`)

        // Find the writing agent using carrier-specific agent number
        console.log(`[Record #${index + 1}] Finding writing agent for number: ${record.writingAgentNumber} (Carrier: ${carriers.name})`)
        const { data: writingAgent, error: agentError } = await supabase
          .from('agent_carrier_numbers')
          .select(`
            agent_id,
            users!inner(
              id,
              upline_id,
              position_id,
              first_name,
              last_name
            )
          `)
          .eq('carrier_id', carriers.id)
          .eq('agent_number', record.writingAgentNumber)
          .single()

        if (agentError || !writingAgent || !writingAgent.users) {
          const errorMessage = `Writing agent not found for carrier ${carrierConfig.name} with agent number: ${record.writingAgentNumber}. Error: ${agentError?.message || 'Not found'}`
          console.log(`[Record #${index + 1}] ERROR: ${errorMessage}`)
          processingErrors.push(errorMessage)
          errorCount++
          continue
        }

        const agentData = writingAgent.users as any
        console.log(`[Record #${index + 1}] Found Writing Agent: ${agentData.first_name} ${agentData.last_name} (ID: ${agentData.id})`)

        // --- Product Lookup ---
        const productNameFromReport = record.product;
        if (!productNameFromReport) {
            console.log(`[Record #${index + 1}] Skipping: Product name is missing in the report.`);
            errorCount++;
            continue;
        }

        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name')
            .eq('carrier_id', carriers.id)
            .eq('is_active', true)
            .eq('agency_id', agencyId)

        if (productsError) {
            throw new Error(`Failed to fetch products for carrier: ${productsError.message}`);
        }

        console.log(`[Record #${index + 1}] Product DB Query: Found ${products.length} product(s) for carrier ${carriers.name}.`);

        let bestMatch: { id: string; name: string } | null = null;
        let highestScore = 0;

        for (const product of products) {
            const score = getProductSimilarity(productNameFromReport, product.name);
            console.log(`[Record #${index + 1}]   - Comparing with "${product.name}", similarity: ${score.toFixed(2)}`);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = product;
            }
        }

        console.log(`[Record #${index + 1}] Product Lookup: Searched for "${productNameFromReport}". Best match is "${bestMatch?.name}" with score ${highestScore.toFixed(2)}.`);

        // If no good match is found, log an error and skip.
        if (!bestMatch || highestScore < 0.7) { // 0.7 is our confidence threshold
            const errorMessage = `No confident product match found for "${productNameFromReport}". Best guess was "${bestMatch?.name || 'none'}" (${(highestScore * 100).toFixed(0)}% confidence). Please check product names.`;
            console.log(`[Record #${index + 1}] ERROR: ${errorMessage}`);
            processingErrors.push(errorMessage);
            errorCount++;
            continue;
        }

        const productId = bestMatch.id;

        // --- Deal Creation/Update ---
        console.log(`[Record #${index + 1}] Upserting deal for policy number: ${record.policyNumber}`)

        const dealData = {
            policy_number: record.policyNumber,
            carrier_id: carriers.id,
            client_name: record.clientName,
            agent_id: agentData.id,
            policy_effective_date: record.effectiveDate,
            annual_premium: commissionablePremium,
            monthly_premium: commissionablePremium / 12,
            writing_agent_number: record.writingAgentNumber,
            product_id: productId,
            status: 'verified', // Commission reports create verified deals
        };

        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .upsert(dealData, {
            // This relies on a UNIQUE constraint on (policy_number, carrier_id)
            // The schema you provided does not show this, which may cause issues if not present.
            onConflict: 'policy_number,carrier_id',
            ignoreDuplicates: false,
          })
          .select()
          .single()

        if (dealError) {
          console.error(`[Record #${index + 1}] Deal upsert failed. Data was:`, dealData)
          throw new Error(`Failed to upsert deal: ${dealError.message}`)
        }
        console.log(`[Record #${index + 1}] Deal processed. ID: ${deal.id}`)

        // Only process positive commission amounts
        if (commissionablePremium > 0) {
          console.log(`[Record #${index + 1}] Commissionable premium is positive. Calculating commission chain...`)
          // Calculate commissions for the agent and their upline chain
          const commissions = await calculateCommissionChain(
            agentData.id,
            carriers.id,
            commissionablePremium,
            commissionReport.id,
            deal.id, // Pass dealId to the function
            productId
          )

          console.log(`[Record #${index + 1}] Calculated ${commissions.length} transaction(s).`)
          commissionTransactions.push(...commissions)
        } else {
            console.log(`[Record #${index + 1}] Skipping commission calculation: Commissionable premium is not positive (${commissionablePremium}).`)
        }

        processedCount++

      } catch (error) {
        const errorMessage = `Error processing record: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`[Record #${index + 1}] FATAL ERROR:`, error)
        processingErrors.push(errorMessage)
        errorCount++
      }
    }

    console.log(`\n=== [Processing Complete] ===`)
    console.log(`- Total Records: ${standardizedRecords.length}`)
    console.log(`- Processed: ${processedCount}`)
    console.log(`- Errors: ${errorCount}`)
    console.log(`- Commission Transactions Created: ${commissionTransactions.length}`)
    if(processingErrors.length > 0) {
        console.log('- Processing Errors:', processingErrors)
    }
    console.log('============================\n')


    // Insert all commission transactions
    if (commissionTransactions.length > 0) {
      console.log(`[DB Insert] Inserting ${commissionTransactions.length} commission transactions...`)
      console.log('Commission Transactions:', commissionTransactions)
      const { error: commissionsError } = await supabase
        .from('commissions')
        .insert(commissionTransactions)

      if (commissionsError) {
        console.error('[DB Insert] Error inserting commissions:', commissionsError)
        // Optionally update the report to reflect this failure
      } else {
        console.log(`[DB Insert] Successfully inserted ${commissionTransactions.length} transactions.`)
      }
    }

    // Update commission report with final counts
    console.log(`[DB Update] Updating commission report ID ${commissionReport.id} with final counts.`)
    await supabase
      .from('commission_reports')
      .update({
        processed_count: processedCount,
        error_count: errorCount,
        status: errorCount > 0 ? 'error' : 'processed'
      })
      .eq('id', commissionReport.id)

    return NextResponse.json({
      success: true,
      reportId: commissionReport.id,
      totalRecords: standardizedRecords.length,
      processedCount,
      errorCount,
      commissionsCreated: commissionTransactions.length,
      carrierConfig: carrierConfig.name,
      fileType: carrierConfig.fileType,
      filePath: storagePath,
      agency: agency.name,
      ...(carrierConfig.fileType === 'excel' && { sheetName: carrierConfig.excelSheetName })
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function calculateCommissionChain(
  agentId: string,
  carrierId: string,
  commissionablePremium: number,
  commissionReportId: string,
  dealId: string,
  productId: string
): Promise<any[]> {
  const commissions: any[] = []
  console.log(`\n--- [CommissionChain] Calculating for Agent ID: ${agentId}, Commissionable Premium: ${commissionablePremium}, Deal ID: ${dealId}, Product ID: ${productId} ---`)

  // Use commission snapshots for this deal to determine levels, upline relationships,
  // commission types, and percentages. Do not create snapshots here.
  try {
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('commission_snapshots')
      .select('agent_id, commission_type, percentage, level, upline_agent_id')
      .eq('deal_id', dealId)
      .order('level')

    if (snapshotsError) {
      console.error('[CommissionChain] Error fetching snapshots:', snapshotsError)
    } else if (snapshots && snapshots.length > 0) {
      let totalPercentageFromSnapshots = 0
      for (const s of snapshots as any[]) {
        totalPercentageFromSnapshots += (s.percentage || 0)
      }

      if (totalPercentageFromSnapshots > 0) {
        for (const s of snapshots as any[]) {
          const share = s.percentage / totalPercentageFromSnapshots
          const amount = commissionablePremium * share
          if (amount > 0) {
            commissions.push({
              agent_id: s.agent_id,
              deal_id: dealId,
              commission_report_id: commissionReportId,
              commission_type: s.commission_type,
              percentage: s.percentage,
              amount,
              premium_amount: commissionablePremium,
              status: 'pending',
              upline_agent_id: s.upline_agent_id,
              level: s.level
            })
          }
        }
        console.log(`[CommissionChain] Used ${snapshots.length} snapshot entries for deal ${dealId}.`)
        return commissions
      } else {
        console.log('[CommissionChain] Snapshots found but total percentage is 0; skipping commission calculation for this record.')
        return commissions
      }
    }
  } catch (e) {
    console.error('[CommissionChain] Unexpected error using snapshots:', e)
  }

  console.log('[CommissionChain] No snapshots available; skipping commission calculation for this record.')
  return commissions
}

// --- REVISED HELPER FUNCTIONS FOR FUZZY STRING MATCHING ---

// Calculates the Levenshtein distance between two strings.
function levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let j = 0; j <= s2.length; j++) {
        costs[j] = j;
    }
    for (let i = 1; i <= s1.length; i++) {
        costs[0] = i;
        let nw = i - 1;
        for (let j = 1; j <= s2.length; j++) {
            const cj = Math.min(
                1 + Math.min(costs[j], costs[j - 1]),
                s1[i - 1] === s2[j - 1] ? nw : nw + 1
            );
            nw = costs[j];
            costs[j] = cj;
        }
    }
    return costs[s2.length];
}

// Calculates a similarity score from 0 to 1 based on Levenshtein distance.
function getProductSimilarity(s1: string, s2: string): number {
    if (s1 === null || s2 === null || typeof s1 === 'undefined' || typeof s2 === 'undefined') return 0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) {
        return 1.0;
    }

    const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
}