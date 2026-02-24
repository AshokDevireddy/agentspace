'use client'

/**
 * NIPR Verification Step
 *
 * Handles NIPR verification through document upload or auto-retrieval.
 * Uses SSE for real-time progress updates when feature flag is enabled.
 */
import { useState, useEffect, useCallback } from 'react'
import { Shield, Upload, FileText, X, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useRunNiprAutomation, useUploadNiprDocument } from '@/hooks/mutations'
import { useNiprSSE } from '@/hooks/useNiprSSE'
import { RateLimitError } from '@/lib/error-utils'
import type { UserData, NiprForm, NiprResult, NiprMode } from '../types'

// localStorage key for persisting NIPR job ID
const NIPR_JOB_STORAGE_KEY = 'nipr_active_job_id'

interface NiprVerificationStepProps {
  userData: UserData
  onComplete: (carriers: string[]) => void
  onSkip: () => void
  niprAlreadyCompleted: boolean
  storedCarriers: string[]
}

export function NiprVerificationStep({
  userData,
  onComplete,
  onSkip,
  niprAlreadyCompleted,
  storedCarriers,
}: NiprVerificationStepProps) {
  // Form state
  const [niprForm, setNiprForm] = useState<NiprForm>({
    lastName: '',
    npn: '',
    ssn: '',
    dob: '',
  })
  const [niprMode, setNiprMode] = useState<NiprMode>('automation')
  const [niprUploadFile, setNiprUploadFile] = useState<File | null>(null)
  const [niprDragging, setNiprDragging] = useState(false)

  // Progress state
  const [niprRunning, setNiprRunning] = useState(false)
  const [niprJobId, setNiprJobId] = useState<string | null>(null)
  const [niprProgress, setNiprProgress] = useState(0)
  const [niprProgressMessage, setNiprProgressMessage] = useState('')
  const [niprQueuePosition, setNiprQueuePosition] = useState<number | null>(null)
  const [niprResult, setNiprResult] = useState<NiprResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  // Mutations
  const runNiprMutation = useRunNiprAutomation()
  const uploadNiprMutation = useUploadNiprDocument()
  const niprUploading = uploadNiprMutation.isPending

  // SSE for real-time updates
  const {
    status: sseStatus,
    progress: sseProgress,
    progressMessage: sseProgressMessage,
    queuePosition: sseQueuePosition,
    resultCarriers: sseCarriers,
    connect: connectSse,
    disconnect: disconnectSse,
  } = useNiprSSE(niprJobId, {
    onCompleted: (data) => {
      setNiprRunning(false)
      setNiprProgress(100)
      setNiprResult({
        success: true,
        message: 'NIPR verification completed successfully!',
        analysis: {
          success: true,
          carriers: data.result_carriers,
          uniqueCarriers: data.result_carriers,
          licensedStates: { resident: [], nonResident: [] },
          analyzedAt: data.completed_at,
        },
      })
      localStorage.removeItem(NIPR_JOB_STORAGE_KEY)
      if (data.result_carriers?.length > 0) {
        onComplete(data.result_carriers)
      }
    },
    onFailed: (data) => {
      setNiprRunning(false)
      setNiprResult({
        success: false,
        message: data.error_message || 'NIPR verification failed. Please try again.',
      })
      localStorage.removeItem(NIPR_JOB_STORAGE_KEY)
    },
  })

  // Update UI from SSE events
  useEffect(() => {
    if (sseStatus !== 'idle') {
      setNiprProgress(sseProgress)
      setNiprProgressMessage(sseProgressMessage)
      setNiprQueuePosition(sseQueuePosition)
    }
  }, [sseStatus, sseProgress, sseProgressMessage, sseQueuePosition])

  // Connect SSE when job ID is set
  useEffect(() => {
    if (niprJobId && niprRunning) {
      connectSse()
    }
    return () => {
      disconnectSse()
    }
  }, [niprJobId, niprRunning, connectSse, disconnectSse])

  // Store carriers in database
  const storeCarriers = useCallback(
    async (carriers: string[]) => {
      if (!userData.id || !Array.isArray(carriers) || carriers.length === 0) return

      try {
        // This will be handled by the parent component
        onComplete(carriers)
      } catch (error) {
        console.error('[NiprVerificationStep] Failed to store carriers:', error)
      }
    },
    [userData.id, onComplete]
  )

  // Validate form
  const validateForm = (): boolean => {
    const validationErrors: string[] = []

    if (!niprForm.lastName.trim()) validationErrors.push('Last name is required')
    if (!niprForm.npn.trim()) validationErrors.push('NPN is required')
    if (!/^\d+$/.test(niprForm.npn)) validationErrors.push('NPN must be numeric')
    if (!niprForm.ssn.trim()) validationErrors.push('Last 4 SSN is required')
    if (!/^\d{4}$/.test(niprForm.ssn)) validationErrors.push('SSN must be exactly 4 digits')
    if (!niprForm.dob.trim()) validationErrors.push('Date of birth is required')
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(niprForm.dob))
      validationErrors.push('DOB must be in MM/DD/YYYY format')

    setErrors(validationErrors)
    return validationErrors.length === 0
  }

  // Run NIPR automation
  const runNiprAutomation = async () => {
    setErrors([])
    setNiprRunning(true)
    setNiprResult(null)
    setNiprJobId(null)
    setNiprProgress(0)
    setNiprProgressMessage('Submitting verification request...')
    setNiprQueuePosition(null)

    if (!validateForm()) {
      setNiprRunning(false)
      return
    }

    runNiprMutation.mutate(niprForm, {
      onSuccess: async (result) => {
        // Handle conflict (already has pending job)
        if (result.status === 'conflict') {
          if (result.jobId) {
            localStorage.setItem(NIPR_JOB_STORAGE_KEY, result.jobId)
            setNiprJobId(result.jobId)
            setNiprProgressMessage(
              result.processing ? 'Verification in progress...' : 'Waiting in queue...'
            )
          }
          return
        }

        // Job was queued
        if (result.queued && result.jobId) {
          localStorage.setItem(NIPR_JOB_STORAGE_KEY, result.jobId)
          setNiprJobId(result.jobId)
          setNiprQueuePosition(result.position || null)
          setNiprProgressMessage(`Waiting in queue (position ${result.position || '?'})...`)
          return
        }

        // Job started processing
        if (result.processing && result.jobId) {
          localStorage.setItem(NIPR_JOB_STORAGE_KEY, result.jobId)
          setNiprJobId(result.jobId)
          setNiprProgressMessage('Starting verification...')
          return
        }

        // Job completed immediately
        if (result.success && result.analysis?.uniqueCarriers) {
          await storeCarriers(result.analysis.uniqueCarriers)
        }

        setNiprResult({
          success: result.success || false,
          message: result.success
            ? 'NIPR verification completed!'
            : result.error || 'NIPR verification failed',
          analysis: result.analysis,
        })
        setNiprRunning(false)
        setNiprProgress(100)
        setNiprProgressMessage('Complete!')
      },
      onError: (error) => {
        console.error('NIPR automation error:', error)
        setNiprRunning(false)

        if (error instanceof RateLimitError) {
          const retryMinutes = Math.ceil(error.retryAfter / 60)
          setNiprResult({
            success: false,
            message: `Rate limit exceeded. Please try again in ${retryMinutes} minute${
              retryMinutes !== 1 ? 's' : ''
            }.`,
          })
          return
        }

        setNiprResult({
          success: false,
          message: error.message || 'Failed to run NIPR automation. Please try again.',
        })
      },
    })
  }

  // Upload NIPR document
  const uploadNiprDocument = async () => {
    if (!niprUploadFile) {
      setErrors(['Please select a PDF file to upload'])
      return
    }

    setErrors([])
    setNiprResult(null)

    uploadNiprMutation.mutate(niprUploadFile, {
      onSuccess: async (result) => {
        if (result.analysis?.carriers && result.analysis.carriers.length > 0) {
          await storeCarriers(result.analysis.carriers)
        }

        setNiprResult({
          success: true,
          message: `Successfully extracted ${
            result.analysis?.carriers?.length || 0
          } carriers from your NIPR document`,
          analysis: {
            success: true,
            carriers: result.analysis?.carriers || [],
            uniqueCarriers: result.analysis?.carriers || [],
            licensedStates: result.analysis?.licensedStates || { resident: [], nonResident: [] },
            analyzedAt: result.analysis?.analyzedAt || new Date().toISOString(),
          },
        })
        setNiprUploadFile(null)
      },
      onError: (error) => {
        console.error('NIPR upload error:', error)
        setNiprResult({
          success: false,
          message: error.message || 'Failed to upload NIPR document. Please try again.',
        })
      },
    })
  }

  // Reset form
  const resetForm = () => {
    setNiprResult(null)
    setNiprJobId(null)
    setNiprProgress(0)
    setNiprProgressMessage('')
    setNiprQueuePosition(null)
    setErrors([])
    localStorage.removeItem(NIPR_JOB_STORAGE_KEY)
  }

  // Auto-advance when NIPR already completed
  useEffect(() => {
    if (niprAlreadyCompleted && storedCarriers.length > 0) {
      onComplete(storedCarriers)
    }
  }, [niprAlreadyCompleted, storedCarriers, onComplete])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">NIPR Verification</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Verify your credentials using your NIPR PDB report
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/30">
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setNiprMode('upload')}
          disabled={niprRunning || niprUploading}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all ${
            niprMode === 'upload'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
        <button
          type="button"
          onClick={() => setNiprMode('automation')}
          disabled={niprRunning || niprUploading}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all ${
            niprMode === 'automation'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="h-4 w-4" />
          Auto-Retrieve
        </button>
      </div>

      {/* Upload Mode */}
      {niprMode === 'upload' && !niprRunning && !niprUploading && !niprResult?.success && (
        <div className="space-y-4">
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              Upload your NIPR PDB Detail Report PDF for instant verification
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div
              className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                niprUploadFile
                  ? 'border-primary bg-primary/5'
                  : niprDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-300 hover:border-primary'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setNiprDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setNiprDragging(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setNiprDragging(false)
                const files = e.dataTransfer.files
                if (files && files.length > 0) {
                  const file = files[0]
                  if (file.name.toLowerCase().endsWith('.pdf')) {
                    setNiprUploadFile(file)
                  } else {
                    setErrors(['Please upload a PDF file'])
                  }
                }
              }}
            >
              {niprUploadFile ? (
                <div className="text-center">
                  <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
                  <p className="text-sm font-medium text-foreground mb-1">{niprUploadFile.name}</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {(niprUploadFile.size / 1024).toFixed(2)} KB
                  </p>
                  <Button onClick={() => setNiprUploadFile(null)} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground mb-2">
                    Drop your NIPR PDF here or click to upload
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">PDF file only (max 50MB)</p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setNiprUploadFile(file)
                    }}
                    className="hidden"
                    id="nipr-upload"
                  />
                  <label
                    htmlFor="nipr-upload"
                    className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg text-sm font-medium inline-block"
                  >
                    Choose File
                  </label>
                </div>
              )}
            </div>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800">
              <strong>How to get your NIPR PDB Report:</strong> Log in to{' '}
              <a
                href="https://pdb.nipr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                pdb.nipr.com
              </a>
              , navigate to "PDB Detail Report", and download the PDF.
            </AlertDescription>
          </Alert>

          {niprUploadFile && (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onSkip}>
                Skip for Now
              </Button>
              <Button onClick={uploadNiprDocument}>Upload & Verify</Button>
            </div>
          )}
        </div>
      )}

      {/* Automation Mode Form */}
      {niprMode === 'automation' && !niprUploading && !niprResult?.success && !niprRunning && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Last Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={niprForm.lastName}
                onChange={(e) => setNiprForm({ ...niprForm, lastName: e.target.value })}
                className="h-10"
                placeholder="Enter your last name"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                NPN (National Producer Number) <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={niprForm.npn}
                onChange={(e) =>
                  setNiprForm({ ...niprForm, npn: e.target.value.replace(/\D/g, '') })
                }
                className="h-10"
                placeholder="e.g., 12345678"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Last 4 digits of SSN <span className="text-destructive">*</span>
              </label>
              <Input
                type="password"
                value={niprForm.ssn}
                onChange={(e) =>
                  setNiprForm({ ...niprForm, ssn: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
                className="h-10"
                placeholder="XXXX"
                maxLength={4}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Date of Birth <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={niprForm.dob}
                onChange={(e) => {
                  let value = e.target.value.replace(/[^\d/]/g, '')
                  if (value.length === 2 && !value.includes('/')) {
                    value = value + '/'
                  } else if (
                    value.length === 5 &&
                    value.charAt(2) === '/' &&
                    !value.slice(3).includes('/')
                  ) {
                    value = value + '/'
                  }
                  setNiprForm({ ...niprForm, dob: value.slice(0, 10) })
                }}
                className="h-10"
                placeholder="MM/DD/YYYY"
                maxLength={10}
              />
            </div>
          </div>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-800">
              <strong>Note:</strong> Auto-retrieval takes 4-6 minutes. We will automatically fetch
              your NIPR PDB report using your credentials.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onSkip}>
              Skip for Now
            </Button>
            <Button onClick={runNiprAutomation}>Start Verification</Button>
          </div>
        </>
      )}

      {/* Progress Display */}
      {niprRunning && (
        <div className="space-y-4 p-6 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            {niprQueuePosition ? (
              <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-foreground">
                  {niprQueuePosition
                    ? `Waiting in queue (position ${niprQueuePosition})`
                    : 'NIPR Verification in Progress'}
                </span>
                <span className="text-sm text-muted-foreground">{niprProgress}%</span>
              </div>
              <Progress value={niprProgress} className="h-2" />
              <p className="mt-2 text-sm text-muted-foreground">
                {niprProgressMessage || 'Processing...'}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Please do not close this page. This process typically takes 4-6 minutes.
          </p>
        </div>
      )}

      {/* Upload Progress */}
      {niprUploading && (
        <div className="space-y-4 p-6 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <span className="font-medium text-foreground">Analyzing your NIPR document...</span>
              <p className="mt-2 text-sm text-muted-foreground">
                Our AI is extracting carrier and license information from your document.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Result Display */}
      {niprResult && !niprRunning && !niprUploading && (
        <Alert
          className={
            niprResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }
        >
          <AlertDescription className={niprResult.success ? 'text-green-800' : 'text-red-800'}>
            <div className="flex items-center gap-2">
              {niprResult.success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span>{niprResult.message}</span>
            </div>
            {!niprResult.success && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Button type="button" variant="default" size="sm" onClick={resetForm}>
                  Try Again
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onSkip}>
                  Skip for Now
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
