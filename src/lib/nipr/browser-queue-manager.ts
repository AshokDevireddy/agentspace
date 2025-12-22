/**
 * Browser Queue Manager for HyperAgent
 *
 * Manages concurrent browser instances for local automation.
 * Limits the number of simultaneous browser sessions to prevent resource exhaustion.
 */

import type { HyperAgent } from '@hyperbrowser/agent'

interface ActiveJob {
  jobId: string
  agent: HyperAgent
  startTime: Date
  userId: string
}

// Default max concurrent browsers (can be overridden by env var)
const DEFAULT_MAX_CONCURRENT = 2

// Job timeout in milliseconds (10 minutes)
const JOB_TIMEOUT_MS = 10 * 60 * 1000

class BrowserQueueManager {
  private static instance: BrowserQueueManager
  private activeJobs: Map<string, ActiveJob> = new Map()
  private maxConcurrent: number
  private jobTimeoutMs: number

  private constructor() {
    this.maxConcurrent = parseInt(process.env.NIPR_MAX_CONCURRENT_BROWSERS || String(DEFAULT_MAX_CONCURRENT), 10)
    this.jobTimeoutMs = parseInt(process.env.NIPR_JOB_TIMEOUT_MS || String(JOB_TIMEOUT_MS), 10)
    console.log(`[BrowserQueueManager] Initialized with maxConcurrent=${this.maxConcurrent}, timeout=${this.jobTimeoutMs}ms`)
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BrowserQueueManager {
    if (!BrowserQueueManager.instance) {
      BrowserQueueManager.instance = new BrowserQueueManager()
    }
    return BrowserQueueManager.instance
  }

  /**
   * Check if we can start a new job
   */
  canStartNewJob(): boolean {
    return this.activeJobs.size < this.maxConcurrent
  }

  /**
   * Get the number of available slots
   */
  getAvailableSlots(): number {
    return Math.max(0, this.maxConcurrent - this.activeJobs.size)
  }

  /**
   * Get current active job count
   */
  getActiveCount(): number {
    return this.activeJobs.size
  }

  /**
   * Get max concurrent limit
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent
  }

  /**
   * Register a new active job
   */
  registerJob(jobId: string, agent: HyperAgent, userId: string): void {
    if (this.activeJobs.has(jobId)) {
      console.warn(`[BrowserQueueManager] Job ${jobId} already registered, updating...`)
    }
    this.activeJobs.set(jobId, {
      jobId,
      agent,
      startTime: new Date(),
      userId,
    })
    console.log(`[BrowserQueueManager] Registered job ${jobId}. Active: ${this.activeJobs.size}/${this.maxConcurrent}`)
  }

  /**
   * Unregister a job when complete
   */
  unregisterJob(jobId: string): void {
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.delete(jobId)
      console.log(`[BrowserQueueManager] Unregistered job ${jobId}. Active: ${this.activeJobs.size}/${this.maxConcurrent}`)
    } else {
      console.warn(`[BrowserQueueManager] Attempted to unregister unknown job ${jobId}`)
    }
  }

  /**
   * Check if a job is currently active
   */
  isJobActive(jobId: string): boolean {
    return this.activeJobs.has(jobId)
  }

  /**
   * Get all active job IDs
   */
  getActiveJobIds(): string[] {
    return Array.from(this.activeJobs.keys())
  }

  /**
   * Cleanup stuck jobs that have exceeded the timeout
   * Returns the number of jobs cleaned up
   */
  async cleanupStuckJobs(): Promise<number> {
    const now = Date.now()
    const stuckJobs: string[] = []

    for (const [jobId, job] of this.activeJobs) {
      const elapsed = now - job.startTime.getTime()
      if (elapsed > this.jobTimeoutMs) {
        stuckJobs.push(jobId)
      }
    }

    let cleanedUp = 0
    for (const jobId of stuckJobs) {
      const job = this.activeJobs.get(jobId)
      if (job) {
        console.log(`[BrowserQueueManager] Cleaning up stuck job ${jobId} (elapsed: ${Math.round((now - job.startTime.getTime()) / 1000)}s)`)
        try {
          await job.agent.closeAgent()
        } catch (error) {
          console.error(`[BrowserQueueManager] Error closing stuck agent for job ${jobId}:`, error)
        }
        this.activeJobs.delete(jobId)
        cleanedUp++
      }
    }

    if (cleanedUp > 0) {
      console.log(`[BrowserQueueManager] Cleaned up ${cleanedUp} stuck job(s). Active: ${this.activeJobs.size}/${this.maxConcurrent}`)
    }

    return cleanedUp
  }

  /**
   * Force cleanup a specific job
   */
  async forceCleanupJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId)
    if (!job) {
      return false
    }

    console.log(`[BrowserQueueManager] Force cleaning up job ${jobId}`)
    try {
      await job.agent.closeAgent()
    } catch (error) {
      console.error(`[BrowserQueueManager] Error force closing agent for job ${jobId}:`, error)
    }
    this.activeJobs.delete(jobId)
    return true
  }

  /**
   * Get queue status for monitoring
   */
  getStatus(): {
    activeCount: number
    maxConcurrent: number
    availableSlots: number
    activeJobs: Array<{ jobId: string; userId: string; elapsedMs: number }>
  } {
    const now = Date.now()
    return {
      activeCount: this.activeJobs.size,
      maxConcurrent: this.maxConcurrent,
      availableSlots: this.getAvailableSlots(),
      activeJobs: Array.from(this.activeJobs.values()).map(job => ({
        jobId: job.jobId,
        userId: job.userId,
        elapsedMs: now - job.startTime.getTime(),
      })),
    }
  }
}

// Export singleton getter
export function getBrowserQueueManager(): BrowserQueueManager {
  return BrowserQueueManager.getInstance()
}

export type { ActiveJob }
