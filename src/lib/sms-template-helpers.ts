/**
 * Replace {{placeholder}} syntax with actual values
 * Handles both {{placeholder}} and {{ placeholder }} (with spaces)
 */
export function replaceSmsPlaceholders(
  template: string,
  placeholders: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(placeholders)) {
    // Match {{key}} with optional spaces: {{key}}, {{ key }}, {{  key  }}, etc.
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
}

/**
 * Default templates used across the application
 */
export const DEFAULT_SMS_TEMPLATES = {
  welcome: 'Welcome {{client_first_name}}! Thank you for choosing {{agency_name}} for your life insurance needs. Your agent {{agent_name}} is here to help. Complete your account setup via the invitation sent to {{client_email}}. Msg&data rates may apply. Reply STOP to opt out.',
  billing_reminder: 'Hi {{client_first_name}}, this is a friendly reminder that your insurance premium is due soon. Please ensure funds are available for your scheduled payment. Thank you!',
  lapse_reminder: 'Hi {{client_first_name}}, your policy is pending lapse. Your agent {{agent_name}} will reach out shortly at this number: {{agent_phone}}',
  birthday: 'Happy Birthday, {{client_first_name}}! Wishing you a great year ahead from your friends at {{agency_name}}.',
  holiday: 'Hi {{client_first_name}}, this is {{agent_name}} your insurance agent! Just wanting to wish you a {{holiday_greeting}}! Hope you\'re having a good one!',
  quarterly: 'Hello {{client_first_name}}, It\'s {{agent_name}}, the insurance agent that helped with your life insurance. I hope you and your family are doing well! If you ever have any questions feel free to call me at my personal number {{agent_phone}}.\n\nI\'m reaching out for our quarterly review of your policy. Please let me know if you would like to make any of these changes:\n\n• Add more coverage\n• Change the premium draft date\n• Need help getting coverage for another family member/friend\n\nPlease feel free to respond to this message with a good time and day to speak with me or feel free to give me a call at {{agent_phone}}',
  policy_packet: 'Hello {{client_first_name}},\n\nI\'m reaching out to see if you received your policy packet yet. If not, please let me know. Thank you.\n\nIf you have received the policy then please respond "Yes."\n\nLastly, please make sure that your beneficiary has my contact information. I\'m here to service your family so please let me know if you need anything.',
};

/**
 * Helper function to capitalize first letter of each word
 */
function capitalizeName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .filter(word => word.length > 0)
    .join(' ');
}

/**
 * Helper function to format beneficiaries list
 */
export function formatBeneficiaries(beneficiaries: Array<{ first_name: string | null; last_name: string | null }> | null | undefined): string {
  if (!beneficiaries || beneficiaries.length === 0) return '';
  
  return beneficiaries
    .map(b => {
      const firstName = capitalizeName(b.first_name);
      const lastName = capitalizeName(b.last_name);
      return `${firstName} ${lastName}`.trim();
    })
    .filter(name => name.length > 0)
    .join(', ');
}

/**
 * Helper function to format agent name with proper capitalization
 */
export function formatAgentName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = capitalizeName(firstName);
  const last = capitalizeName(lastName);
  return `${first} ${last}`.trim();
}

/**
 * Placeholder definitions for each template type
 */
export const SMS_TEMPLATE_PLACEHOLDERS = {
  welcome: ['client_first_name', 'agency_name', 'agent_name', 'agent_phone', 'client_email', 'insured', 'policy_number', 'face_amount', 'monthly_premium', 'initial_draft', 'carrier_name', 'beneficiaries'],
  billing_reminder: ['client_first_name', 'agent_phone', 'insured', 'policy_number', 'face_amount', 'monthly_premium', 'initial_draft', 'carrier_name', 'beneficiaries'],
  lapse_reminder: ['client_first_name', 'agent_name', 'agent_phone', 'insured', 'policy_number', 'face_amount', 'monthly_premium', 'initial_draft', 'carrier_name', 'beneficiaries'],
  birthday: ['client_first_name', 'agency_name', 'agent_phone', 'insured', 'policy_number', 'face_amount', 'monthly_premium', 'initial_draft', 'carrier_name', 'beneficiaries'],
  holiday: ['client_first_name', 'agent_name', 'agent_phone', 'holiday_greeting', 'insured', 'policy_number', 'face_amount', 'monthly_premium', 'initial_draft', 'carrier_name', 'beneficiaries'],
  quarterly: ['client_first_name', 'agent_name', 'agent_phone', 'insured', 'policy_number', 'face_amount', 'monthly_premium', 'initial_draft', 'carrier_name', 'beneficiaries'],
  policy_packet: ['client_first_name', 'agent_phone', 'insured', 'policy_number', 'face_amount', 'monthly_premium', 'initial_draft', 'carrier_name', 'beneficiaries'],
};
