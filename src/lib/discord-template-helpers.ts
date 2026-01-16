/**
 * Discord Template Helpers
 *
 * Utilities for managing Discord notification templates with placeholder variables.
 * Similar to SMS template system, uses {{variable_name}} syntax.
 */

export const DEFAULT_DISCORD_TEMPLATE = '🎉 **New Deal Posted!**\n\n**Agent:** {{agent_name}}\n**Carrier:** {{carrier_name}}\n**Product:** {{product_name}}\n**Annual Premium:** ${{annual_premium}}';

export const DISCORD_TEMPLATE_PLACEHOLDERS = [
  'agent_name',
  'carrier_name',
  'product_name',
  'monthly_premium',
  'annual_premium',
  'client_name',
  'policy_number',
  'effective_date',
];

/**
 * Replace placeholders in Discord template with actual values
 *
 * @param template - Template string with {{variable}} placeholders
 * @param placeholders - Object with variable names as keys and values to replace
 * @returns Rendered Discord message
 *
 * @example
 * ```typescript
 * const message = replaceDiscordPlaceholders(
 *   '**Agent:** {{agent_name}}\n**Premium:** ${{annual_premium}}',
 *   { agent_name: 'John Doe', annual_premium: '1200.00' }
 * );
 * // Returns: "**Agent:** John Doe\n**Premium:** $1200.00"
 * ```
 */
export function replaceDiscordPlaceholders(
  template: string,
  placeholders: Record<string, string>
): string {
  let result = template;

  // Replace each placeholder with its value
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
}

/**
 * Format currency for Discord messages
 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Format date for Discord messages (YYYY-MM-DD)
 */
export function formatDate(date: string): string {
  return date;
}
