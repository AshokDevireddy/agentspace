import { LangfuseClient } from '@langfuse/client';

// Singleton client instance
let langfuseClient: LangfuseClient | null = null;

/**
 * Check if Langfuse is configured
 */
export function isLangfuseEnabled(): boolean {
  return !!(
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY
  );
}

/**
 * Get the Langfuse client singleton
 */
export function getLangfuseClient(): LangfuseClient | null {
  if (!isLangfuseEnabled()) {
    return null;
  }

  if (!langfuseClient) {
    langfuseClient = new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
    });
  }

  return langfuseClient;
}

// Anthropic model pricing (per 1M tokens, in USD)
export const ANTHROPIC_PRICING = {
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cachedInput: 0.3,
  },
  'claude-haiku-4-5': {
    input: 0.8,
    output: 4.0,
    cachedInput: 0.08,
  },
  // Fallback pricing
  default: {
    input: 3.0,
    output: 15.0,
    cachedInput: 0.3,
  },
} as const;

export type AnthropicModel = keyof typeof ANTHROPIC_PRICING;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface CostBreakdown {
  inputCostCents: number;
  outputCostCents: number;
  cachedCostCents: number;
  totalCostCents: number;
}

/**
 * Calculate cost in cents from token counts
 */
export function calculateCost(
  model: string,
  usage: TokenUsage
): CostBreakdown {
  const pricing =
    ANTHROPIC_PRICING[model as AnthropicModel] || ANTHROPIC_PRICING.default;

  const inputCostCents =
    (usage.inputTokens / 1_000_000) * pricing.input * 100;
  const outputCostCents =
    (usage.outputTokens / 1_000_000) * pricing.output * 100;
  const cachedCostCents =
    ((usage.cachedInputTokens || 0) / 1_000_000) * pricing.cachedInput * 100;

  return {
    inputCostCents: Math.round(inputCostCents * 10000) / 10000,
    outputCostCents: Math.round(outputCostCents * 10000) / 10000,
    cachedCostCents: Math.round(cachedCostCents * 10000) / 10000,
    totalCostCents:
      Math.round((inputCostCents + outputCostCents + cachedCostCents) * 10000) /
      10000,
  };
}

