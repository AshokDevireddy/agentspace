// @ts-nocheck - Deno runtime types
// supabase/functions/send-lapse-notification/index.ts
// Triggered by database trigger when a deal's status matches a lapse status in status_mapping
// Uses staged notification system:
// - If status_standardized IS NULL → sets to 'lapse_email_notified'
// - If status_standardized = 'lapse_sms_notified' → sets to 'lapse_sms_and_email_notified'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RequestBody {
  deal_id: string
  agency_id: string
}

interface DealDetails {
  id: string
  client_name: string
  monthly_premium: number | null
  annual_premium: number | null
  policy_number: string | null
  policy_effective_date: string | null
  agent_id: string
  carrier: { name: string } | null
}

interface AgencySettings {
  lapse_email_notifications_enabled: boolean
  lapse_email_subject: string | null
  lapse_email_body: string | null
}

interface Agent {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

const must = (v: string | undefined, name: string) => {
  if (!v) throw new Error(`${name} is not set in Edge function env`)
  return v
}

const SUPABASE_URL = must(Deno.env.get('SUPABASE_URL'), 'SUPABASE_URL')
const SERVICE_ROLE_KEY = must(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), 'SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = must(Deno.env.get('RESEND_API_KEY'), 'RESEND_API_KEY')
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@agentspace.com'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Replace placeholders in template
function replacePlaceholders(template: string, placeholders: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
  }
  return result
}

// Convert plain text to HTML paragraphs
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .split('\n')
    .map(line => `<p style="margin: 0 0 10px 0;">${line || '&nbsp;'}</p>`)
    .join('')
}

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Lapse Notification] Resend error:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Lapse Notification] Send error:', error)
    return { success: false, error }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const body: RequestBody = await req.json()
    const { deal_id, agency_id } = body

    if (!deal_id || !agency_id) {
      return new Response(JSON.stringify({ error: 'deal_id and agency_id are required' }), { status: 400 })
    }

    console.log(`[Lapse Notification] Processing deal ${deal_id} for agency ${agency_id}`)

    // 1. Fetch agency email settings
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('lapse_email_notifications_enabled, lapse_email_subject, lapse_email_body')
      .eq('id', agency_id)
      .single()

    if (agencyError || !agency) {
      console.error('[Lapse Notification] Failed to fetch agency:', agencyError)
      return new Response(JSON.stringify({ error: 'Failed to fetch agency settings' }), { status: 500 })
    }

    if (!agency.lapse_email_notifications_enabled) {
      console.log('[Lapse Notification] Notifications disabled for agency', agency_id)
      return new Response(JSON.stringify({ sent: 0, message: 'Notifications disabled' }), { status: 200 })
    }

    // 2. Fetch deal details
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        id,
        client_name,
        monthly_premium,
        annual_premium,
        policy_number,
        policy_effective_date,
        agent_id,
        carrier:carriers(name)
      `)
      .eq('id', deal_id)
      .single()

    if (dealError || !deal) {
      console.error('[Lapse Notification] Failed to fetch deal:', dealError)
      return new Response(JSON.stringify({ error: 'Failed to fetch deal details' }), { status: 500 })
    }

    // 3. Fetch all agents from deal_hierarchy_snapshot
    const { data: hierarchySnapshot, error: hierarchyError } = await supabase
      .from('deal_hierarchy_snapshot')
      .select('agent_id')
      .eq('deal_id', deal_id)

    if (hierarchyError) {
      console.error('[Lapse Notification] Failed to fetch hierarchy:', hierarchyError)
      return new Response(JSON.stringify({ error: 'Failed to fetch hierarchy' }), { status: 500 })
    }

    if (!hierarchySnapshot || hierarchySnapshot.length === 0) {
      console.log('[Lapse Notification] No agents in hierarchy for deal', deal_id)
      return new Response(JSON.stringify({ sent: 0, message: 'No agents in hierarchy' }), { status: 200 })
    }

    // 4. Get unique agent IDs and fetch their emails
    const agentIds = [...new Set(hierarchySnapshot.map(h => h.agent_id))]

    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', agentIds)

    if (agentsError || !agents || agents.length === 0) {
      console.error('[Lapse Notification] Failed to fetch agents:', agentsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch agent emails' }), { status: 500 })
    }

    // 5. Get writing agent name
    const writingAgent = agents.find(a => a.id === deal.agent_id)
    const agentName = writingAgent
      ? `${writingAgent.first_name || ''} ${writingAgent.last_name || ''}`.trim()
      : 'Unknown'

    // 6. Build placeholders
    const premium = deal.monthly_premium
      ? deal.monthly_premium.toFixed(2)
      : deal.annual_premium
        ? deal.annual_premium.toFixed(2)
        : '0.00'

    const placeholders: Record<string, string> = {
      client_name: deal.client_name || 'Unknown Client',
      premium,
      carrier: (deal.carrier as any)?.name || 'Unknown Carrier',
      policy_number: deal.policy_number || 'N/A',
      agent_name: agentName,
      policy_effective_date: deal.policy_effective_date || 'N/A',
    }

    // 7. Build email subject and body
    const subject = replacePlaceholders(agency.lapse_email_subject || 'Policy Lapse Alert', placeholders)
    const bodyText = replacePlaceholders(agency.lapse_email_body || '', placeholders)
    const bodyHtml = textToHtml(bodyText)

    // 8. Send emails to all agents with valid emails
    let sentCount = 0
    const errors: string[] = []

    for (const agent of agents) {
      if (!agent.email) continue

      const result = await sendEmail(agent.email, subject, bodyHtml)
      if (result.success) {
        console.log(`[Lapse Notification] Email sent to ${agent.email}`)
        sentCount++
      } else {
        console.error(`[Lapse Notification] Failed to send to ${agent.email}:`, result.error)
        errors.push(`${agent.email}: ${result.error}`)
      }
    }

    console.log(`[Lapse Notification] Complete: ${sentCount} emails sent for deal ${deal_id}`)

    // Update status_standardized using staged notification logic
    // Only update if at least one email was sent
    if (sentCount > 0) {
      // Fetch current status to determine new status
      const { data: currentDeal } = await supabase
        .from('deals')
        .select('status_standardized')
        .eq('id', deal_id)
        .single()

      const currentStatus = currentDeal?.status_standardized
      // If SMS was already sent (lapse_sms_notified) → lapse_sms_and_email_notified
      // Otherwise → lapse_email_notified
      const newStatus = currentStatus === 'lapse_sms_notified'
        ? 'lapse_sms_and_email_notified'
        : 'lapse_email_notified'

      const { error: updateError } = await supabase
        .from('deals')
        .update({ status_standardized: newStatus })
        .eq('id', deal_id)

      if (updateError) {
        console.error(`[Lapse Notification] Failed to update status_standardized:`, updateError)
      } else {
        console.log(`[Lapse Notification] Updated status_standardized to ${newStatus}`)
      }
    }

    return new Response(
      JSON.stringify({
        sent: sentCount,
        total: agents.filter(a => a.email).length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (err) {
    console.error('[Lapse Notification] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500 }
    )
  }
})
