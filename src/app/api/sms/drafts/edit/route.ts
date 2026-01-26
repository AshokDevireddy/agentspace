/**
 * Edit SMS Draft API Route
 *
 * Updates the body of a draft SMS message.
 * Reads authentication from httpOnly session cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const body = await request.json()
    const { messageId, body: newBody } = body

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      )
    }

    if (!newBody || typeof newBody !== 'string' || !newBody.trim()) {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      )
    }

    // Update draft message body
    const { data, error: updateError } = await supabase
      .from('messages')
      .update({
        body: newBody.trim(),
      })
      .eq('id', messageId)
      .eq('status', 'draft')
      .select()
      .single()

    if (updateError) {
      console.error('Error updating draft message:', updateError)
      return NextResponse.json(
        { error: 'Failed to update draft message' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Draft message not found' },
        { status: 404 }
      )
    }

    console.log(`✅ Draft message ${messageId} updated`)

    return NextResponse.json({
      success: true,
      message: data,
    })
  } catch (error) {
    console.error('Error in edit draft endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
