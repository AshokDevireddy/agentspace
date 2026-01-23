/**
 * NIPR SSE Hook
 *
 * Real-time updates for NIPR verification progress via Server-Sent Events.
 * Replaces 30-second polling with instant updates from Django backend.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_DJANGO_API_URL || ''

type NiprStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed'

interface NiprProgress {
  job_id: string
  status: NiprStatus
  progress: number
  progress_message: string
  queue_position: number | null
}

interface NiprCompletedResult extends NiprProgress {
  result_files: string[]
  result_carriers: string[]
  completed_at: string
}

interface NiprFailedResult extends NiprProgress {
  error_message: string
}

interface UseNiprSSEOptions {
  onProgress?: (data: NiprProgress) => void
  onCompleted?: (data: NiprCompletedResult) => void
  onFailed?: (data: NiprFailedResult) => void
  onError?: (error: Error) => void
}

interface UseNiprSSEReturn {
  status: NiprStatus
  progress: number
  progressMessage: string
  queuePosition: number | null
  resultCarriers: string[]
  resultFiles: string[]
  errorMessage: string | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
}

/**
 * Hook for real-time NIPR verification progress via SSE
 *
 * Usage:
 * ```tsx
 * const { status, progress, progressMessage, connect, disconnect } = useNiprSSE(jobId, {
 *   onCompleted: (result) => {
 *     console.log('NIPR verification completed:', result.result_carriers)
 *   },
 *   onFailed: (result) => {
 *     console.error('NIPR verification failed:', result.error_message)
 *   },
 * })
 *
 * // Start listening when job is created
 * useEffect(() => {
 *   if (jobId) {
 *     connect()
 *   }
 *   return () => disconnect()
 * }, [jobId, connect, disconnect])
 * ```
 */
export function useNiprSSE(
  jobId: string | null,
  options: UseNiprSSEOptions = {}
): UseNiprSSEReturn {
  const { onProgress, onCompleted, onFailed, onError } = options

  const [status, setStatus] = useState<NiprStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [resultCarriers, setResultCarriers] = useState<string[]>([])
  const [resultFiles, setResultFiles] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [])

  const connect = useCallback(() => {
    // Don't connect if no job ID
    if (!jobId) {
      return
    }

    // Close existing connection
    disconnect()

    // Reset state
    setStatus('pending')
    setProgress(0)
    setProgressMessage('Connecting...')
    setQueuePosition(null)
    setResultCarriers([])
    setResultFiles([])
    setErrorMessage(null)

    try {
      const url = `${API_BASE}/api/onboarding/nipr/sse?job_id=${jobId}`
      const es = new EventSource(url, { withCredentials: true })
      eventSourceRef.current = es

      es.onopen = () => {
        setIsConnected(true)
        setProgressMessage('Connected, waiting for updates...')
      }

      es.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data) as NiprProgress
          setStatus(data.status as NiprStatus)
          setProgress(data.progress)
          setProgressMessage(data.progress_message)
          setQueuePosition(data.queue_position)
          onProgress?.(data)
        } catch (e) {
          console.error('[useNiprSSE] Failed to parse progress event:', e)
        }
      })

      es.addEventListener('completed', (event) => {
        try {
          const data = JSON.parse(event.data) as NiprCompletedResult
          setStatus('completed')
          setProgress(100)
          setProgressMessage('Verification complete!')
          setResultCarriers(data.result_carriers || [])
          setResultFiles(data.result_files || [])
          onCompleted?.(data)
          // Auto-disconnect on completion
          disconnect()
        } catch (e) {
          console.error('[useNiprSSE] Failed to parse completed event:', e)
        }
      })

      es.addEventListener('failed', (event) => {
        try {
          const data = JSON.parse(event.data) as NiprFailedResult
          setStatus('failed')
          setErrorMessage(data.error_message)
          setProgressMessage('Verification failed')
          onFailed?.(data)
          // Auto-disconnect on failure
          disconnect()
        } catch (e) {
          console.error('[useNiprSSE] Failed to parse failed event:', e)
        }
      })

      es.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          setErrorMessage(data.error)
          onError?.(new Error(data.error))
        } catch {
          // Generic error
          setErrorMessage('Connection error')
          onError?.(new Error('SSE connection error'))
        }
        disconnect()
      })

      es.addEventListener('timeout', () => {
        setProgressMessage('Connection timed out, please refresh')
        disconnect()
      })

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setIsConnected(false)
        }
      }
    } catch (e) {
      console.error('[useNiprSSE] Failed to create EventSource:', e)
      onError?.(e instanceof Error ? e : new Error('Failed to connect'))
    }
  }, [jobId, disconnect, onProgress, onCompleted, onFailed, onError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    status,
    progress,
    progressMessage,
    queuePosition,
    resultCarriers,
    resultFiles,
    errorMessage,
    isConnected,
    connect,
    disconnect,
  }
}

export type { NiprStatus, NiprProgress, NiprCompletedResult, NiprFailedResult }
