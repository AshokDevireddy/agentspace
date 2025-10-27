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

