// API ROUTE: /api/upload-policy-reports
// This endpoint handles uploading policy reports CSV files to Supabase storage
// Files are organized by agency_id and carrier name in the bucket structure
// NOTE: Auth and agency lookup use Django. File storage still uses Supabase Storage
// for now - a full migration to S3 would require changes to file retrieval patterns.

import { createAdminClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-config'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Validates the uploaded file to ensure it meets requirements
 * Checks file type, size, and basic structure
 *
 * @param file - The uploaded file object
 * @returns Promise<boolean> - True if file is valid
 */
async function validateFile(file: File): Promise<boolean> {
  try {
    // Check file type - only allow CSV and Excel files
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Only CSV and Excel files are allowed.`)
    }

    // Check file size - limit to 10MB
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > maxSize) {
      throw new Error(`File size exceeds limit. Maximum size is 10MB.`)
    }

    // Check if file has content
    if (file.size === 0) {
      throw new Error('File is empty')
    }

    return true
  } catch (error) {
    console.error('File validation error:', error)
    throw error
  }
}

/**
 * Sanitizes the carrier name to be safe for use in file paths
 * Removes special characters and normalizes the name
 *
 * @param carrierName - The carrier name from the upload
 * @returns string - Sanitized carrier name safe for file paths
 */
function sanitizeCarrierName(carrierName: string): string {
  return carrierName
    .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters except spaces, hyphens, underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase()
    .trim()
}

/**
 * Generates the storage path for the uploaded file
 * Format: {bucket_name}/{agency_id}/{carrier_name}/{filename}
 *
 * @param agencyId - The agency ID
 * @param carrierName - The carrier name
 * @param fileName - The original file name
 * @returns string - The storage path
 */
function generateStoragePath(agencyId: string, carrierName: string, fileName: string): string {
  const sanitizedCarrier = sanitizeCarrierName(carrierName)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')

  return `${agencyId}/${sanitizedCarrier}/${timestamp}_${sanitizedFileName}`
}


/**
 * Deletes entire carrier folder if it exists
 * This is much faster than listing and deleting individual files
 *
 * @param supabase - Supabase client instance
 * @param agencyId - The agency ID
 * @param carrierName - The carrier name (sanitized)
 * @returns Promise<{success: boolean, deletedCount?: number, error?: string}>
 */
async function deleteCarrierFolderIfExists(
  supabase: any,
  agencyId: string,
  carrierName: string
): Promise<{success: boolean, deletedCount?: number, error?: string}> {
  try {
    const bucketName = process.env.SUPABASE_POLICY_REPORTS_BUCKET_NAME
    if (!bucketName) {
      return { success: false, error: 'SUPABASE_POLICY_REPORTS_BUCKET_NAME environment variable is not set' }
    }
    const folderPath = `${agencyId}/${carrierName}`

    // First, check if folder exists by trying to list it
    const { data: existingFiles, error: listError } = await supabase.storage
      .from(bucketName)
      .list(folderPath, {
        limit: 1000 // Get all files in folder
      })

    // If folder doesn't exist, that's fine - nothing to delete
    if (listError && (listError.message.includes('not found') || listError.message.includes('does not exist'))) {
      return { success: true, deletedCount: 0 }
    }

    if (listError) {
      console.error('Error checking folder existence:', listError)
      return { success: false, error: listError.message }
    }

    // If folder exists but is empty, nothing to delete
    if (!existingFiles || existingFiles.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    // Delete entire folder by removing all files at once
    const filePaths = existingFiles.map((file: any) => `${folderPath}/${file.name}`)

    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove(filePaths)

    if (deleteError) {
      console.error('Error deleting folder:', deleteError)
      return { success: false, error: deleteError.message }
    }

    console.log(`Successfully deleted ${existingFiles.length} file(s) from carrier folder: ${folderPath}`)
    return { success: true, deletedCount: existingFiles.length }

  } catch (error) {
    console.error('Error deleting carrier folder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error while deleting folder'
    }
  }
}

/**
 * Replaces existing files in carrier folder with new upload
 * Optimized workflow: Delete entire folder if exists, then upload new file
 * This is much faster than the previous approach
 *
 * @param supabase - Supabase client instance
 * @param agencyId - The agency ID
 * @param carrierName - The carrier name
 * @param file - The new file to upload
 * @param storagePath - The path where the file should be stored
 * @returns Promise<{success: boolean, path?: string, deletedCount?: number, error?: string}>
 */
async function replaceFileInCarrierFolder(
  supabase: any,
  agencyId: string,
  carrierName: string,
  file: File,
  storagePath: string
): Promise<{success: boolean, path?: string, deletedCount?: number, error?: string}> {
  try {
    const sanitizedCarrier = sanitizeCarrierName(carrierName)

    // Step 1: Delete entire carrier folder if it exists (much faster!)
    const deleteResult = await deleteCarrierFolderIfExists(
      supabase,
      agencyId,
      sanitizedCarrier
    )

    if (!deleteResult.success) {
      return {
        success: false,
        error: `Failed to delete existing files: ${deleteResult.error}`
      }
    }

    const deletedCount = deleteResult.deletedCount || 0

    // Log deletion results
    if (deletedCount > 0) {
      console.log(`Successfully deleted ${deletedCount} existing file(s) for carrier ${carrierName}`)
    } else {
      console.log(`No existing files found for carrier ${carrierName}, uploading new file`)
    }

    // Step 2: Upload the new file
    const uploadResult = await uploadFileToStorage(supabase, file, storagePath)

    if (!uploadResult.success) {
      return {
        success: false,
        error: `Failed to upload new file: ${uploadResult.error}`
      }
    }

    return {
      success: true,
      path: uploadResult.path,
      deletedCount
    }
  } catch (error) {
    console.error('Error replacing file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during file replacement'
    }
  }
}

/**
 * Uploads a file to Supabase storage bucket
 * Handles the actual file upload process with error handling
 *
 * @param supabase - Supabase client instance
 * @param file - The file to upload
 * @param storagePath - The path where the file should be stored
 * @returns Promise<{success: boolean, path?: string, error?: string}>
 */
async function uploadFileToStorage(
  supabase: any,
  file: File,
  storagePath: string
): Promise<{success: boolean, path?: string, error?: string}> {
  try {
    const bucketName = process.env.SUPABASE_POLICY_REPORTS_BUCKET_NAME
    if (!bucketName) {
      return { success: false, error: 'SUPABASE_POLICY_REPORTS_BUCKET_NAME environment variable is not set' }
    }

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer()

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true // Allow overwriting (though we handle replacement manually)
      })

    if (error) {
      console.error('Storage upload error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, path: data.path }
  } catch (error) {
    console.error('File upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    }
  }
}

/**
 * Processes multiple file uploads for different carriers
 * Handles validation, path generation, and file replacement for each carrier
 * Each carrier's folder will have its existing files replaced with the new upload
 *
 * @param supabase - Supabase client instance
 * @param agencyId - The agency ID
 * @param uploads - Array of carrier upload objects
 * @returns Promise<{success: boolean, results: any[], errors: string[]}>
 */
async function processFileUploads(
  supabase: any,
  agencyId: string,
  uploads: Array<{carrier: string, file: File}>
): Promise<{success: boolean, results: any[], errors: string[]}> {
  const results: any[] = []
  const errors: string[] = []

  for (const upload of uploads) {
    try {
      // Validate file
      await validateFile(upload.file)

      // Generate storage path
      const storagePath = generateStoragePath(
        agencyId,
        upload.carrier,
        upload.file.name
      )

      // Replace existing files and upload new file
      const replaceResult = await replaceFileInCarrierFolder(
        supabase,
        agencyId,
        upload.carrier,
        upload.file,
        storagePath
      )

      if (replaceResult.success) {
        results.push({
          carrier: upload.carrier,
          fileName: upload.file.name,
          storagePath: replaceResult.path,
          size: upload.file.size,
          type: upload.file.type,
          deletedCount: replaceResult.deletedCount || 0
        })

        // Log replacement details
        if (replaceResult.deletedCount && replaceResult.deletedCount > 0) {
          console.log(`Replaced ${replaceResult.deletedCount} existing file(s) for carrier ${upload.carrier}`)
        } else {
          console.log(`No existing files found for carrier ${upload.carrier}, uploaded new file`)
        }
      } else {
        errors.push(`${upload.carrier}: ${replaceResult.error}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${upload.carrier}: ${errorMessage}`)
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors
  }
}

/**
 * Main POST handler for the upload-policy-reports endpoint
 * Handles authentication, file processing, and response formatting
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate via session and get agency from Django
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    const apiUrl = getApiBaseUrl()
    const userResponse = await fetch(`${apiUrl}/api/user/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    const userData = await userResponse.json()
    const agencyId = userData.agency_id

    if (!agencyId) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User is not associated with an agency' },
        { status: 401 }
      )
    }

    // Use Supabase admin client for storage operations
    const supabase = createAdminClient()

    // Parse form data
    const formData = await request.formData()
    const uploads: Array<{carrier: string, file: File}> = []

    // Extract files from form data
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        // Extract carrier name from the key (assuming format like "carrier_Aetna")
        const carrierMatch = key.match(/carrier_(.+)/)
        if (carrierMatch) {
          uploads.push({
            carrier: carrierMatch[1],
            file: value
          })
        }
      }
    }

    // Check if any files were uploaded
    if (uploads.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded', detail: 'Please upload at least one policy report file' },
        { status: 400 }
      )
    }

    // Process file uploads
    const uploadResults = await processFileUploads(supabase, agencyId, uploads)

    // Calculate total files replaced
    const totalFilesReplaced = uploadResults.results.reduce((sum, result) => sum + (result.deletedCount || 0), 0)

    // Prepare response
    const response = {
      success: uploadResults.success,
      message: uploadResults.success
        ? `Successfully uploaded ${uploadResults.results.length} file(s)${totalFilesReplaced > 0 ? ` and replaced ${totalFilesReplaced} existing file(s)` : ''}`
        : 'Some files failed to upload',
      agencyId,
      bucketName: process.env.SUPABASE_POLICY_REPORTS_BUCKET_NAME,
      totalFilesReplaced,
      results: uploadResults.results,
      errors: uploadResults.errors
    }

    return NextResponse.json(response, {
      status: uploadResults.success ? 200 : 207 // 207 = Multi-Status for partial success
    })

  } catch (error) {
    console.error('Upload policy reports API error:', error)

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'An unexpected error occurred during file upload'
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for retrieving upload status or file information
 * Can be used to check existing files or get upload history
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate via session and get agency from Django
    const session = await getSession()
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    const apiUrl = getApiBaseUrl()
    const userResponse = await fetch(`${apiUrl}/api/user/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User authentication failed' },
        { status: 401 }
      )
    }

    const userData = await userResponse.json()
    const agencyId = userData.agency_id

    if (!agencyId) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User is not associated with an agency' },
        { status: 401 }
      )
    }

    const bucketName = process.env.SUPABASE_POLICY_REPORTS_BUCKET_NAME

    if (!bucketName) {
      return NextResponse.json(
        { error: 'Configuration error', detail: 'SUPABASE_POLICY_REPORTS_BUCKET_NAME environment variable is not set' },
        { status: 500 }
      )
    }

    // Use Supabase admin client for storage operations
    const supabase = createAdminClient()

    // List files in the agency's folder
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(agencyId, {
        limit: 100,
        offset: 0
      })

    if (error) {
      console.error('Error listing files:', error)
      return NextResponse.json(
        { error: 'Failed to list files', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      agencyId,
      bucketName,
      files: files || []
    })

  } catch (error) {
    console.error('Get policy reports API error:', error)

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
