/**
 * Telnyx SMS API Integration
 * Handles sending SMS messages via Telnyx API
 */

const TELNYX_API_URL = 'https://api.telnyx.com/v2/messages';

interface SendSMSParams {
  from: string;
  to: string;
  text: string;
}

interface TelnyxResponse {
  data: {
    id: string;
    record_type: string;
    direction: string;
    to: Array<{ phone_number: string; status: string }>;
    from: { phone_number: string };
    text: string;
    messaging_profile_id: string;
  };
}

/**
 * Normalizes a phone number to E.164 format (+1XXXXXXXXXX) for sending SMS
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it already starts with +, return as is
  if (phone.startsWith('+')) {
    return `+${digits}`;
  }

  // Otherwise, just return the digits with +
  return `+${digits}`;
}

/**
 * Normalizes a phone number for database storage (10 digits, no +1 prefix)
 * Consistent with how deals table stores phone numbers
 */
export function normalizePhoneForStorage(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's 11 digits starting with 1 (e.g., +16692456363 or 16692456363), remove the leading 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1); // Return last 10 digits
  }

  // If it's already 10 digits, return as is
  if (digits.length === 10) {
    return digits;
  }

  // For any other format, just return the digits (edge case)
  return digits;
}

/**
 * Formats a phone number for human-readable display: (XXX) XXX-XXXX
 * Handles any input format — strips non-digits first, then formats.
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Handle 11-digit numbers with leading 1
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.substring(1) : digits;
  if (normalized.length !== 10) return phone; // Return as-is if not 10 digits
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

/**
 * Sends an SMS message via Telnyx API
 */
export async function sendSMS({ from, to, text }: SendSMSParams): Promise<TelnyxResponse> {
  const apiKey = process.env.TELNYX_API_KEY;

  if (!apiKey) {
    throw new Error('TELNYX_API_KEY is not configured');
  }

  // Normalize phone numbers
  const normalizedFrom = normalizePhoneNumber(from);
  const normalizedTo = normalizePhoneNumber(to);

  // Pre-flight validation: reject obviously invalid numbers before calling Telnyx
  if (!isValidPhoneNumber(to)) {
    const reason = getPhoneValidationError(to) || 'Invalid phone number';
    throw new Error(`Telnyx API error: 40310 - ${reason}`);
  }

  const response = await fetch(TELNYX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: normalizedFrom,
      to: normalizedTo,
      text,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telnyx API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Verifies Telnyx webhook signature (optional but recommended)
 */
export function verifyWebhookSignature(
  _payload: string,
  _signature: string,
  _timestamp: string
): boolean {
  const webhookSecret = process.env.TELNYX_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // If no secret is configured, skip verification
    return true;
  }

  // Implement signature verification based on Telnyx docs
  // For now, returning true. Add proper verification in production
  return true;
}

/**
 * Validates a phone number for SMS delivery per E.164 / NANP rules.
 * NANP format is NXX-NXX-XXXX where N = 2-9, X = 0-9.
 * Returns true only if: exactly 10 US digits (or 11 starting with "1"),
 * area code first digit 2-9, and exchange code first digit 2-9.
 * Accepts null/undefined safely (returns false).
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');

  // Normalize to 10 digits
  let tenDigits: string;
  if (digits.length === 10) {
    tenDigits = digits;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    tenDigits = digits.substring(1);
  } else {
    return false;
  }

  // NANP: area code (NPA) first digit must be 2-9
  if (tenDigits[0] < '2' || tenDigits[0] > '9') return false;

  // NANP: exchange code (NXX) first digit must be 2-9
  if (tenDigits[3] < '2' || tenDigits[3] > '9') return false;

  return true;
}

/**
 * Returns a human-readable reason why a phone number is invalid, or null if valid.
 * Checks E.164 / NANP rules: 10-digit length, area code (NPA) 2-9, exchange (NXX) 2-9.
 * Used to give users actionable error messages.
 */
export function getPhoneValidationError(phone: string | null | undefined): string | null {
  if (!phone) return 'No phone number on file for this client. Add a valid 10-digit US phone number in the deal.';

  const digits = phone.replace(/\D/g, '');
  const display = formatPhoneForDisplay(phone) !== phone ? formatPhoneForDisplay(phone) : phone;

  if (digits.length === 0) return 'The phone number on file is empty. Add a valid 10-digit US phone number in the deal.';
  if (digits.length < 10) return `Phone number ${display} is too short (${digits.length} digits). A valid US number must be 10 digits.`;
  if (digits.length === 11 && !digits.startsWith('1')) return `Phone number ${display} has 11 digits but doesn't start with country code 1.`;
  if (digits.length > 11) return `Phone number ${display} is too long (${digits.length} digits). A valid US number must be 10 digits.`;

  // Normalize to 10 digits for NANP checks
  const tenDigits = digits.length === 11 ? digits.substring(1) : digits;

  // NANP: area code (NPA) first digit must be 2-9
  if (tenDigits[0] === '0' || tenDigits[0] === '1') {
    return `Phone number ${display} has an invalid area code (${tenDigits.slice(0, 3)}). US area codes must start with a digit 2–9.`;
  }

  // NANP: exchange code (NXX) first digit must be 2-9
  if (tenDigits[3] === '0' || tenDigits[3] === '1') {
    return `Phone number ${display} has an invalid exchange code (${tenDigits.slice(3, 6)}). The three digits after the area code must start with 2–9.`;
  }

  return null;
}

/**
 * Detects Telnyx landline/non-routable error codes (40001, 40100).
 * These indicate the destination number cannot receive SMS (e.g. standard landline).
 */
export function isLandlineError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('40001') || msg.includes('40100');
}

/**
 * Detects Telnyx invalid-phone error codes:
 *   10002 — "Invalid phone number" (request-level validation)
 *   40002 — "Invalid phone number" (request-level)
 *   40310 — "Invalid 'to' address" (message-level)
 * Any of these indicate the destination number is not valid/routable.
 */
export function isInvalidPhoneError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('40310') || msg.includes('10002') || msg.includes('40002');
}

/**
 * Detects urgent keywords in message body
 */
export function containsUrgentKeywords(messageBody: string): boolean {
  const urgentKeywords = [
    "don't have money",
    "don't have the money",
    "can't pay",
    "cannot pay",
    "call me",
    "need help",
    "emergency",
    "urgent",
    "problem",
    "cancel policy",
    "cancelling",
  ];

  const lowerBody = messageBody.toLowerCase();
  return urgentKeywords.some(keyword => lowerBody.includes(keyword));
}

