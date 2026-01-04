import Langfuse from 'langfuse';
import { calculateCost, type TokenUsage, type CostBreakdown } from './langfuse';
import type Anthropic from '@anthropic-ai/sdk';

// Langfuse client singleton
let langfuseClient: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return null;
  }

  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
    });
  }

  return langfuseClient;
}

// Types for tracing
export interface TraceMetadata {
  userId: string;
  agencyId: string;
  sessionId?: string;
  conversationId?: string;
  isAdmin?: boolean;
  subscriptionTier?: string;
}

export interface StreamingAccumulator {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheCreationTokens: number;
}

// Trace and span types from Langfuse SDK
type LangfuseTrace = ReturnType<Langfuse['trace']>;
type LangfuseSpan = ReturnType<LangfuseTrace['span']>;
type LangfuseGeneration = ReturnType<LangfuseTrace['generation']>;

export type TraceHandle = { trace: LangfuseTrace } | null;
export type GenerationHandle = { generation: LangfuseGeneration } | null;
export type SpanHandle = { span: LangfuseSpan } | null;

/**
 * Create a root trace for an AI chat request
 */
export function createChatTrace(metadata: TraceMetadata): TraceHandle {
  const langfuse = getLangfuse();
  if (!langfuse) {
    return null;
  }

  try {
    const trace = langfuse.trace({
      name: 'ai-chat-request',
      userId: metadata.userId,
      sessionId: metadata.sessionId || metadata.conversationId,
      metadata: {
        userId: metadata.userId,
        agencyId: metadata.agencyId,
        conversationId: metadata.conversationId,
        isAdmin: metadata.isAdmin,
        subscriptionTier: metadata.subscriptionTier,
        environment: process.env.NODE_ENV,
      },
      tags: ['ai-chat', metadata.subscriptionTier || 'unknown'].filter(Boolean) as string[],
    });

    return { trace };
  } catch (error) {
    console.error('[Langfuse] Failed to create chat trace:', error);
    return null;
  }
}

/**
 * Create a generation span for an LLM call within a trace
 */
export function createGenerationSpan(
  traceHandle: TraceHandle,
  model: string,
  messages: Anthropic.MessageParam[],
  iterationIndex: number = 0
): GenerationHandle {
  if (!traceHandle) {
    return null;
  }

  try {
    const generation = traceHandle.trace.generation({
      name: `llm-generation-${iterationIndex}`,
      model,
      input: messages,
      modelParameters: {
        max_tokens: 4096,
        stream: true,
      },
    });

    return { generation };
  } catch (error) {
    console.error('[Langfuse] Failed to create generation span:', error);
    return null;
  }
}

/**
 * Create a tool execution span
 */
export function createToolSpan(
  traceHandle: TraceHandle,
  toolName: string,
  toolInput: Record<string, unknown>
): SpanHandle {
  if (!traceHandle) {
    return null;
  }

  try {
    const span = traceHandle.trace.span({
      name: `tool-${toolName}`,
      input: toolInput,
      metadata: { toolName },
    });

    return { span };
  } catch (error) {
    console.error('[Langfuse] Failed to create tool span:', error);
    return null;
  }
}

/**
 * Finalize a generation span with usage data
 */
export function finalizeGeneration(
  generationHandle: GenerationHandle,
  model: string,
  accumulator: StreamingAccumulator,
  output: string | object
): CostBreakdown {
  const usage: TokenUsage = {
    inputTokens: accumulator.inputTokens,
    outputTokens: accumulator.outputTokens,
    cachedInputTokens: accumulator.cachedInputTokens,
  };

  const costs = calculateCost(model, usage);

  if (generationHandle) {
    try {
      generationHandle.generation.end({
        output,
        usage: {
          input: accumulator.inputTokens,
          output: accumulator.outputTokens,
          total: accumulator.inputTokens + accumulator.outputTokens + accumulator.cachedInputTokens,
          unit: 'TOKENS',
          inputCost: costs.inputCostCents / 100,
          outputCost: costs.outputCostCents / 100,
          totalCost: costs.totalCostCents / 100,
        },
      });
    } catch (error) {
      console.error('[Langfuse] Failed to finalize generation:', error);
    }
  }

  return costs;
}

/**
 * Finalize a tool span with result
 */
export function finalizeTool(
  spanHandle: SpanHandle,
  result: unknown,
  executionTimeMs: number,
  wasAllowed: boolean = true,
  error?: string
): void {
  if (!spanHandle) {
    return;
  }

  try {
    spanHandle.span.end({
      output: result,
      metadata: {
        executionTimeMs,
        wasAllowed,
        error,
      },
      level: wasAllowed ? 'DEFAULT' : 'WARNING',
      statusMessage: error,
    });
  } catch (err) {
    console.error('[Langfuse] Failed to finalize tool:', err);
  }
}

/**
 * Finalize the root trace
 */
export function finalizeTrace(
  traceHandle: TraceHandle,
  success: boolean,
  totalIterations: number,
  error?: string
): void {
  if (!traceHandle) {
    return;
  }

  try {
    traceHandle.trace.update({
      output: {
        success,
        totalIterations,
        error,
      },
    });

    // Flush to ensure trace is sent
    const langfuse = getLangfuse();
    if (langfuse) {
      langfuse.flushAsync().catch((err) => {
        console.error('[Langfuse] Failed to flush:', err);
      });
    }
  } catch (err) {
    console.error('[Langfuse] Failed to finalize trace:', err);
  }
}

/**
 * Create an accumulator for tracking tokens during streaming
 */
export function createStreamingAccumulator(): StreamingAccumulator {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationTokens: 0,
  };
}

/**
 * Update accumulator from Anthropic streaming event
 */
export function updateAccumulatorFromEvent(
  accumulator: StreamingAccumulator,
  event: Anthropic.MessageStreamEvent
): void {
  // Handle message_start event which contains input token info
  if (event.type === 'message_start' && event.message?.usage) {
    const usage = event.message.usage;
    accumulator.inputTokens += usage.input_tokens || 0;
    accumulator.cachedInputTokens += usage.cache_read_input_tokens ?? 0;
    accumulator.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0;
  }

  // Handle message_delta event which contains output token info
  if (event.type === 'message_delta' && event.usage) {
    accumulator.outputTokens += event.usage.output_tokens || 0;
  }
}

/**
 * Get trace ID from a trace handle (for database correlation)
 */
export function getTraceId(traceHandle: TraceHandle): string | null {
  if (!traceHandle) {
    return null;
  }

  try {
    return traceHandle.trace.id || null;
  } catch {
    return null;
  }
}

/**
 * Check if Langfuse is initialized
 */
export function isLangfuseInitialized(): boolean {
  return getLangfuse() !== null;
}
