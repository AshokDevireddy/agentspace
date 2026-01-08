/**
 * Replace {{placeholder}} syntax with actual values
 */
export function replaceSmsPlaceholders(
  template: string,
  placeholders: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
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
};

/**
 * Placeholder definitions for each template type
 */
export const SMS_TEMPLATE_PLACEHOLDERS = {
  welcome: ['client_first_name', 'agency_name', 'agent_name', 'client_email'],
  billing_reminder: ['client_first_name'],
  lapse_reminder: ['client_first_name', 'agent_name', 'agent_phone'],
  birthday: ['client_first_name', 'agency_name'],
};
