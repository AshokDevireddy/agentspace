/**
 * Langfuse Wrapper with Circuit Breaker
 *
 * Provides graceful degradation when Langfuse is unavailable.
 * All Langfuse operations are non-blocking and fire-and-forget.
 */

import { isLangfuseEnabled } from './langfuse';
import {
  createChatTrace,
  createGenerationSpan,
  createToolSpan,
  finalizeGeneration,
  finalizeTool,
  finalizeTrace,
  createStreamingAccumulator,
  updateAccumulatorFromEvent,
  getTraceId,
  isLangfuseInitialized,
  type TraceMetadata,
  type StreamingAccumulator,
  type TraceHandle,
  type GenerationHandle,
  type SpanHandle,
} from './langfuse-tracing';
import type Anthropic from '@anthropic-ai/sdk';
import type { CostBreakdown } from './langfuse';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// Circuit breaker configuration
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60000; // 1 minute

// Track if we've logged the disabled message
let hasLoggedDisabled = false;

// Circuit breaker state (module-level singleton)
const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

/**
 * Check if circuit breaker allows operations
 */
function isCircuitClosed(): boolean {
  if (!circuitBreaker.isOpen) {
    return true;
  }

  // Check if reset timeout has passed
  if (Date.now() - circuitBreaker.lastFailure > RESET_TIMEOUT_MS) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    console.log('[Langfuse] Circuit breaker reset');
    return true;
  }

  return false;
}

/**
 * Record a failure and potentially open the circuit
 */
function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= FAILURE_THRESHOLD) {
    circuitBreaker.isOpen = true;
    console.warn('[Langfuse] Circuit breaker opened after', circuitBreaker.failures, 'failures');
  }
}

/**
 * Reset failure count on successful operation
 */
function recordSuccess(): void {
  if (circuitBreaker.failures > 0) {
    circuitBreaker.failures = 0;
  }
}

/**
 * Safe wrapper that handles errors and circuit breaker
 */
function safeExecute<T>(operation: () => T, fallback: T): T {
  if (!isLangfuseEnabled()) {
    if (!hasLoggedDisabled) {
      console.log('[Langfuse] Tracing disabled - LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY not set');
      hasLoggedDisabled = true;
    }
    return fallback;
  }

  if (!isLangfuseInitialized() || !isCircuitClosed()) {
    return fallback;
  }

  try {
    const result = operation();
    recordSuccess();
    return result;
  } catch (error) {
    recordFailure();
    console.error('[Langfuse] Operation failed:', error);
    return fallback;
  }
}

/**
 * Safe wrapper for async operations (fire-and-forget)
 */
function safeExecuteAsync(operation: () => void | Promise<void>): void {
  if (!isLangfuseEnabled() || !isLangfuseInitialized() || !isCircuitClosed()) {
    // Skip silently - safeExecute already logs the disabled message
    return;
  }

  Promise.resolve()
    .then(() => operation())
    .then(() => recordSuccess())
    .catch((error) => {
      recordFailure();
      console.error('[Langfuse] Async operation failed:', error);
    });
}

/**
 * LangfuseTracer - A wrapped interface for Langfuse operations
 * with circuit breaker and graceful degradation
 */
export class LangfuseTracer {
  private trace: TraceHandle = null;
  private currentGeneration: GenerationHandle = null;
  private accumulator: StreamingAccumulator;
  private metadata: TraceMetadata;
  private model: string;
  private iterationIndex: number = 0;

  constructor(metadata: TraceMetadata, model: string = 'claude-sonnet-4-5') {
    this.metadata = metadata;
    this.model = model;
    this.accumulator = createStreamingAccumulator();
    // Create trace immediately (no async needed with direct Langfuse SDK)
    this.trace = safeExecute(() => createChatTrace(metadata), null);
  }

  /**
   * Start a new generation span (call before each LLM API call)
   */
  startGeneration(messages: Anthropic.MessageParam[]): void {
    this.currentGeneration = safeExecute(
      () => createGenerationSpan(this.trace, this.model, messages, this.iterationIndex),
      null
    );
    this.iterationIndex++;
    // Reset accumulator for new generation
    this.accumulator = createStreamingAccumulator();
  }

  /**
   * Track a streaming event
   */
  trackStreamEvent(event: Anthropic.MessageStreamEvent): void {
    updateAccumulatorFromEvent(this.accumulator, event);
  }

  /**
   * End the current generation with output
   */
  endGeneration(output: string | object): CostBreakdown {
    const costs = finalizeGeneration(
      this.currentGeneration,
      this.model,
      this.accumulator,
      output
    );
    this.currentGeneration = null;
    return costs;
  }

  /**
   * Start a tool execution span
   */
  startTool(toolName: string, toolInput: Record<string, unknown>): SpanHandle {
    return safeExecute(
      () => createToolSpan(this.trace, toolName, toolInput),
      null
    );
  }

  /**
   * End a tool execution span
   */
  endTool(
    toolSpan: SpanHandle,
    result: unknown,
    executionTimeMs: number,
    wasAllowed: boolean = true,
    error?: string
  ): void {
    safeExecuteAsync(() => finalizeTool(toolSpan, result, executionTimeMs, wasAllowed, error));
  }

  /**
   * End the entire trace
   */
  endTrace(success: boolean, error?: string): void {
    safeExecuteAsync(() =>
      finalizeTrace(this.trace, success, this.iterationIndex, error)
    );
    this.trace = null;
  }

  /**
   * Get the trace ID for database correlation
   */
  getTraceId(): string | null {
    return getTraceId(this.trace);
  }

  /**
   * Get the current token accumulator
   */
  getAccumulator(): StreamingAccumulator {
    return { ...this.accumulator };
  }

  /**
   * Check if tracing is active
   */
  isActive(): boolean {
    return this.trace !== null;
  }
}

/**
 * Create a new Langfuse tracer instance
 */
export function createTracer(
  metadata: TraceMetadata,
  model: string = 'claude-sonnet-4-5'
): LangfuseTracer {
  return new LangfuseTracer(metadata, model);
}
