"use client"

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCreatePolicyReportJob, useSignPolicyReportFiles } from '@/hooks/mutations/usePolicyReportMutations'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X, TrendingUp, Loader2 } from "lucide-react"
import { putToSignedUrl } from '@/lib/upload-policy-reports/client'
import { useNotification } from '@/contexts/notification-context'
import { useAuth } from '@/providers/AuthProvider'
import { cn } from '@/lib/utils'

interface PolicyReportFile {
  id: string
  file: File
}

const supportedCarriers = [
  'Aetna',
  'Aflac',
  'American Amicable',
  'Combined Insurance',
  'American Home Life',
  'Royal Neighbors',
  'Liberty Bankers Life',
  'Transamerica',
  'Foresters',
  'Reagan CRM Data',
  'Ethos',
  'Mutual of Omaha',
  'Americo',
]

export default function UploadPolicyReportsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { showSuccess, showError, showWarning } = useNotification()
  const { userData } = useAuth()
  const [policyReportFiles, setPolicyReportFiles] = useState<PolicyReportFile[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Use centralized mutation hooks
  const createJobMutation = useCreatePolicyReportJob()
  const signFilesMutation = useSignPolicyReportFiles({ agencyId: userData?.agency_id })

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = droppedFiles.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return extension === 'csv' || extension === 'xlsx' || extension === 'xls'
    })

    if (validFiles.length === 0) {
      showWarning('Please drop CSV or Excel files only.')
      return
    }

    const newFiles: PolicyReportFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file
    }))

    setPolicyReportFiles(prev => [...prev, ...newFiles])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const validFiles = selectedFiles.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return extension === 'csv' || extension === 'xlsx' || extension === 'xls'
    })

    if (validFiles.length === 0) {
      showWarning('Please select CSV or Excel files only.')
      return
    }

    const newFiles: PolicyReportFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file
    }))

    setPolicyReportFiles(prev => [...prev, ...newFiles])
    
    // Reset input
    if (e.target) {
      e.target.value = ''
    }
  }

  const handleFileRemove = (fileId: string) => {
    setPolicyReportFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Combined upload mutation using centralized hooks
  const uploadMutation = useMutation({
    mutationFn: async (files: PolicyReportFile[]) => {
      // Use agency_id from AuthProvider (already cached)
      const agencyId = userData?.agency_id

      if (!agencyId) {
        throw new Error('Could not resolve your agency. Please refresh and try again.')
      }

      // Step 1: Create an ingest job using centralized mutation
      const expectedFiles = files.length
      const clientJobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      const jobResult = await createJobMutation.mutateAsync({
        agencyId,
        expectedFiles,
        clientJobId,
      })

      const jobId = jobResult.job.jobId
      console.debug('Created ingest job', { jobId, expectedFiles })

      // Step 2: Request presigned URLs using centralized mutation
      const signResult = await signFilesMutation.mutateAsync({
        jobId,
        files: files.map(({ file }) => ({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        })),
      })

      // Step 3: Upload each file via its presigned URL (no chunking; URLs expire in 60s)
      const results = await Promise.allSettled(
        signResult.files.map(async (f) => {
          const match = files.find(pf => pf.file.name === f.fileName)
          if (!match) throw new Error(`Missing file for ${f.fileName}`)
          const res = await putToSignedUrl(f.presignedUrl, match.file)
          if (!res.ok) throw new Error(`Upload failed with status ${res.status}`)
          return { fileName: f.fileName, fileId: f.fileId }
        })
      )

      // Step 4: Summarize uploads
      const successes: { carrier: string; file: string; paths: string[] }[] = []
      const failures: string[] = []

      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          successes.push({ carrier: 'n/a', file: r.value.fileName, paths: [] })
        } else {
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          failures.push(reason)
        }
      })

      if (successes.length) console.log('Uploaded:', successes)
      if (failures.length) console.error('Failed uploads:', failures)

      if (failures.length === 0) {
        return { successes, failures, message: `Successfully uploaded ${successes.length} file(s).` }
      } else {
        throw new Error(`Uploaded ${successes.length} file(s), but ${failures.length} failed: ${failures.join(', ')}`)
      }
    },
    onSuccess: (data) => {
      showSuccess(data.message)
      setPolicyReportFiles([])
      // Cache invalidation is handled by the centralized mutations
      onClose()
    },
    onError: (error: Error) => {
      console.error('Unexpected error during upload:', error)

      // Show appropriate notification based on error type
      if (error.message.includes('Uploaded') && error.message.includes('failed')) {
        showWarning(error.message)
      } else {
        showError(error.message || 'An unexpected error occurred while uploading. Please try again.')
      }

      // Always reset state and close modal on error
      setPolicyReportFiles([])
      onClose()
    }
  })

  const handleAnalyze = () => {
    if (policyReportFiles.length === 0) {
      showWarning('Please upload at least one policy report before analyzing.')
      return
    }

    uploadMutation.mutate(policyReportFiles)
  }



  const handleCancel = () => onClose()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setPolicyReportFiles([])
        uploadMutation.reset()
      }
      onClose()
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-foreground">
            Upload Policy Reports
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Drag and drop CSV or Excel files for any carrier to analyze persistency rates
          </DialogDescription>
        </DialogHeader>

        {/* Supported Carriers List */}
        <div className="mb-4 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm font-semibold text-foreground mb-2">Supported Carriers:</p>
          <div className="flex flex-wrap gap-2">
            {supportedCarriers.map((carrier) => (
              <span
                key={carrier}
                className="text-xs px-2 py-1 bg-background border border-border rounded-md text-muted-foreground"
              >
                {carrier}
              </span>
            ))}
          </div>
        </div>

        {/* Drag and Drop Area */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-12 mb-6 transition-colors",
            isDragging
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 bg-transparent dark:bg-slate-900/40"
          )}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className={cn(
              "h-16 w-16 mb-4 transition-colors",
              isDragging
                ? "text-primary"
                : "text-gray-400 dark:text-gray-300"
            )} />
            <p className="text-lg font-medium text-foreground mb-2">
              {isDragging ? "Drop files here" : "Drag and drop files here"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInputChange}
              multiple
              className="hidden"
              id="policy-report-upload-modal"
            />
            <label
              htmlFor="policy-report-upload-modal"
              className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-md text-sm font-medium transition-colors inline-block"
            >
              Choose Files
            </label>
            <p className="text-xs text-muted-foreground mt-4">
              Supported formats: CSV, XLSX, XLS
            </p>
          </div>
        </div>

        {/* Uploaded Files List */}
        {policyReportFiles.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Uploaded Files ({policyReportFiles.length})
            </h3>
            <div className="space-y-2">
              {policyReportFiles.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(fileItem.file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Button
                    onClick={() => handleFileRemove(fileItem.id)}
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center space-x-4 mt-8">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="px-6 py-2"
            disabled={uploadMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={uploadMutation.isPending || policyReportFiles.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Analyze Persistency
              </>
            )}
          </Button>
        </div>

        <div className="mt-6 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">Instructions</h3>
          <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200 list-disc list-inside">
            <li>Drag and drop one or more CSV or Excel files into the upload area above</li>
            <li>Files will be automatically processed to calculate persistency rates and track policy status</li>
            <li>New uploads will replace any existing files for the same carrier</li>
            <li>Supported carriers: {supportedCarriers.join(', ')}</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
