import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth/get-user-context'
import { getApiBaseUrl } from '@/lib/api-config'
import { getAccessToken } from '@/lib/session'
import { replaceDiscordPlaceholders, DEFAULT_DISCORD_TEMPLATE } from '@/lib/discord-template-helpers'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication using Django session
    const userResult = await getUserContext()
    if (!userResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { agencyId, placeholders } = body

    if (!agencyId || !placeholders) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the agency's Discord webhook settings from Django backend
    const accessToken = await getAccessToken()
    const apiUrl = getApiBaseUrl()

    const settingsResponse = await fetch(`${apiUrl}/api/agencies/${agencyId}/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!settingsResponse.ok) {
      console.error('[Discord Webhook API] Failed to fetch agency settings:', settingsResponse.status)
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }

    const agency = await settingsResponse.json()

    const webhookUrl = agency.discord_webhook_url
    const useCustomTemplate = agency.discord_notification_enabled ?? false
    const customTemplate = agency.discord_notification_template
    const botUsername = agency.discord_bot_username || 'AgentSpace Deal Bot'

    // If no webhook URL is configured, skip silently (not an error)
    if (!webhookUrl) {
      return NextResponse.json({
        success: true,
        message: 'No webhook configured, notification skipped'
      })
    }

    // Use custom template only if explicitly enabled, otherwise use default
    const template = (useCustomTemplate && customTemplate) ? customTemplate : DEFAULT_DISCORD_TEMPLATE

    // Render the template with placeholders
    const message = replaceDiscordPlaceholders(template, placeholders)

    // Send the Discord webhook with configurable username
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        username: botUsername,
      }),
    })

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text()
      console.error('[Discord Webhook API] Discord webhook failed:', errorText)
      return NextResponse.json({
        error: 'Failed to send Discord notification',
        details: errorText
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Discord notification sent successfully'
    })

  } catch (error) {
    console.error('[Discord Webhook API] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
