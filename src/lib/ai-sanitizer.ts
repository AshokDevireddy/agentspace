/**
 * AI Response Sanitization Module
 *
 * This module sanitizes data before sending it to the LLM or back to the client.
 * It removes sensitive fields that should never be exposed through AI responses.
 */

import { UserContext } from './ai-permissions';

// Fields that should NEVER be exposed to AI or clients
const ALWAYS_REDACT_FIELDS = new Set([
  // Personal identifiable sensitive info
  'ssn',
  'social_security',
  'social_security_number',
  'tax_id',
  'ein',

  // Financial credentials
  'bank_account',
  'bank_account_number',
  'routing_number',
  'ach_routing',
  'ach_account',

  // Authentication & security
  'password',
  'password_hash',
  'api_key',
  'api_secret',
  'auth_token',
  'access_token',
  'refresh_token',
  'secret_key',
  'private_key',

  // Stripe/payment credentials
  'stripe_secret',
  'stripe_api_key',
  'payment_method_id',

  // Session & internal tokens
  'session_token',
  'jwt_token',
  'verification_code',
  'reset_token',
  'magic_link_token',
]);

// Fields that are only visible to admins (redacted for non-admins)
const ADMIN_ONLY_FIELDS = new Set([
  // Commission details (sensitive business data)
  'commission_percentage',
  'hierarchy_commission_percentage',
  'total_debt',
  'debt_amount',
  'payout_amount',
  'expected_payout',

  // Internal operational data
  'cost_per_lead',
  'lead_cost',
  'marketing_spend',
  'margin',
  'profit_margin',

  // Internal notes
  'admin_notes',
  'internal_notes',
  'private_notes',
]);

// Fields that should be partially masked (show last 4 chars)
const PARTIAL_MASK_FIELDS = new Set([
  'npn',
  'national_producer_number',
  'policy_number',
  'phone_number',
  'phone',
  'client_phone',
]);

/**
 * Check if a field name matches a sensitive pattern
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return ALWAYS_REDACT_FIELDS.has(lowerField);
}

/**
 * Check if a field is admin-only
 */
function isAdminOnlyField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return ADMIN_ONLY_FIELDS.has(lowerField);
}

/**
 * Check if a field should be partially masked
 */
function shouldPartialMask(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return PARTIAL_MASK_FIELDS.has(lowerField);
}

/**
 * Partially mask a value (show last 4 characters)
 */
function partialMask(value: string): string {
  if (typeof value !== 'string' || value.length <= 4) {
    return '****';
  }
  return '****' + value.slice(-4);
}

/**
 * Deep sanitize an object, removing or masking sensitive fields
 */
export function sanitizeForAI(
  data: any,
  context: UserContext,
  depth: number = 0
): any {
  const MAX_DEPTH = 10;

  // Prevent infinite recursion
  if (depth > MAX_DEPTH) {
    return '[max depth reached]';
  }

  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForAI(item, context, depth + 1));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // Always redact sensitive fields
      if (isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Redact admin-only fields for non-admins
      if (!context.is_admin && isAdminOnlyField(key)) {
        sanitized[key] = '[ADMIN ACCESS REQUIRED]';
        continue;
      }

      // Partially mask certain fields
      if (shouldPartialMask(key) && typeof value === 'string') {
        sanitized[key] = partialMask(value);
        continue;
      }

      // Recursively sanitize nested objects/arrays
      sanitized[key] = sanitizeForAI(value, context, depth + 1);
    }

    return sanitized;
  }

  return data;
}

/**
 * Sanitize a tool result before sending to LLM
 * This applies both privacy sanitization and size limits
 */
export function sanitizeToolResult(
  toolName: string,
  result: any,
  context: UserContext
): any {
  // First apply privacy sanitization
  const sanitizedResult = sanitizeForAI(result, context);

  // Return the sanitized result
  return sanitizedResult;
}

/**
 * Create a summary of input for audit logging
 * Removes any sensitive data before logging
 */
export function summarizeInputForAudit(input: any): any {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const summary: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    // Skip internal fields
    if (key.startsWith('__')) {
      continue;
    }

    // Redact sensitive fields
    if (isSensitiveField(key)) {
      summary[key] = '[REDACTED]';
      continue;
    }

    // For arrays, just log the count
    if (Array.isArray(value)) {
      summary[key] = `[Array: ${value.length} items]`;
      continue;
    }

    // For objects, just log that it's an object
    if (typeof value === 'object' && value !== null) {
      summary[key] = '[Object]';
      continue;
    }

    // For strings, truncate if too long
    if (typeof value === 'string' && value.length > 100) {
      summary[key] = value.substring(0, 100) + '...';
      continue;
    }

    summary[key] = value;
  }

  return summary;
}

/**
 * Validate that response doesn't contain sensitive patterns
 * Used as a final check before sending to client
 */
export function validateResponseSafety(response: string): {
  safe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Patterns that should never appear in responses
  const sensitivePatterns = [
    // SSN pattern
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN' },
    // Full credit card
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, name: 'Credit Card' },
    // Bank account (long number sequences)
    { pattern: /\b\d{10,17}\b/, name: 'Account Number' },
    // API keys (common patterns)
    { pattern: /sk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe Key' },
    { pattern: /sk-[a-zA-Z0-9]{32,}/, name: 'API Key' },
  ];

  for (const { pattern, name } of sensitivePatterns) {
    if (pattern.test(response)) {
      warnings.push(`Potential ${name} detected in response`);
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Clean user message input to prevent injection attacks
 */
export function sanitizeUserInput(message: string): string {
  // Remove any attempt to inject system prompts
  const cleaned = message
    // Remove attempts to close system context
    .replace(/```system/gi, '```')
    .replace(/<system>/gi, '')
    .replace(/<\/system>/gi, '')
    // Remove attempts to inject tool definitions
    .replace(/```tool/gi, '```')
    // Limit consecutive whitespace
    .replace(/\s{10,}/g, ' ')
    // Limit message length (prevent token abuse)
    .substring(0, 10000);

  return cleaned;
}
