import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { agencyId, message } = body

    if (!agencyId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the agency's Discord webhook URL
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('discord_webhook_url')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }

    const webhookUrl = agency.discord_webhook_url

    // If no webhook URL is configured, skip silently (not an error)
    if (!webhookUrl) {
      return NextResponse.json({
        success: true,
        message: 'No webhook configured, notification skipped'
      })
    }

    // Send the Discord webhook
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        username: 'AgentSpace Deal Bot',
      }),
    })

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text()
      console.error('Discord webhook error:', errorText)
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
    console.error('Error sending Discord webhook:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

