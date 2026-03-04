/**
 * NIPR SSE Hook
 *
 * Real-time updates for NIPR verification progress via Server-Sent Events.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiBaseUrl } from '@/lib/api-config'
import { getAccessToken } from '@/lib/auth/token-store'

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
  const [status, setStatus] = useState<NiprStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [resultCarriers, setResultCarriers] = useState<string[]>([])
  const [resultFiles, setResultFiles] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)

  // Store callbacks in a ref so connect/disconnect stay stable across renders
  const callbacksRef = useRef(options)
  callbacksRef.current = options

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [])

  const connect = useCallback(() => {
    if (!jobId) return

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setStatus('pending')
    setProgress(0)
    setProgressMessage('Connecting...')
    setQueuePosition(null)
    setResultCarriers([])
    setResultFiles([])
    setErrorMessage(null)

    try {
      const token = getAccessToken()
      const url = `${getApiBaseUrl()}/api/onboarding/nipr/sse?job_id=${jobId}${token ? `&token=${encodeURIComponent(token)}` : ''}`
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
          callbacksRef.current.onProgress?.(data)
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
          callbacksRef.current.onCompleted?.(data)
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
          callbacksRef.current.onFailed?.(data)
          disconnect()
        } catch (e) {
          console.error('[useNiprSSE] Failed to parse failed event:', e)
        }
      })

      es.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          setErrorMessage(data.error)
          callbacksRef.current.onError?.(new Error(data.error))
        } catch {
          setErrorMessage('Connection error')
          callbacksRef.current.onError?.(new Error('SSE connection error'))
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
      callbacksRef.current.onError?.(e instanceof Error ? e : new Error('Failed to connect'))
    }
  }, [jobId, disconnect])

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
