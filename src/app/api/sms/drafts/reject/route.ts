import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messageIds } = body // Array of message IDs to reject

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: 'Message IDs are required' },
        { status: 400 }
      )
    }

    // Delete draft messages (rejection = deletion)
    // First verify the messages exist and are drafts
    const { data: messagesToDelete, error: fetchError } = await supabase
      .from('messages')
      .select('id, status')
      .in('id', messageIds)
      .eq('status', 'draft')

    if (fetchError) {
      console.error('Error fetching messages to delete:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch draft messages' },
        { status: 500 }
      )
    }

    if (!messagesToDelete || messagesToDelete.length === 0) {
      console.log('⚠️  No draft messages found to delete')
      return NextResponse.json({
        success: true,
        rejected: 0
      })
    }

    // Now delete them
    const { error: deleteError, data: deletedData } = await supabase
      .from('messages')
      .delete()
      .in('id', messageIds)
      .eq('status', 'draft')
      .select()

    if (deleteError) {
      console.error('Error deleting draft messages:', deleteError)
      return NextResponse.json(
        { error: 'Failed to reject draft messages' },
        { status: 500 }
      )
    }

    const deletedCount = deletedData?.length || 0
    console.log(`✅ Rejected and deleted ${deletedCount} draft messages`)

    return NextResponse.json({
      success: true,
      rejected: deletedCount
    })

  } catch (error) {
    console.error('Error in reject draft endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
