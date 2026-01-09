"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { Loader2, MessageSquare, UserCircle } from "lucide-react"
import { useNotification } from '@/contexts/notification-context'
import { useApiFetch } from '@/hooks/useApiFetch'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { useApproveDrafts, useRejectDrafts } from '@/hooks/mutations'

interface DraftMessage {
  id: string
  body: string
  direction: string
  metadata: any
  createdAt: string | null
}

interface DraftGroup {
  conversationId: string
  dealId: string
  clientName: string
  clientPhone: string
  agentName: string
  messages: DraftMessage[]
}

interface DraftListViewProps {
  viewMode: 'downlines' | 'self' | 'all'
  onClose?: () => void
  onConversationClick?: (conversationId: string) => void
}

export function DraftListView({ viewMode, onClose, onConversationClick }: DraftListViewProps) {
  const { showSuccess, showError } = useNotification()
  const queryClient = useQueryClient()
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set())

  // Fetch drafts using TanStack Query
  const { data, isLoading: loading } = useApiFetch<{ drafts: DraftGroup[] }>(
    queryKeys.draftsList(viewMode),
    `/api/sms/drafts?view=${viewMode}`
  )

  const draftGroups = data?.drafts || []

  // Use centralized mutation hooks
  const approveMutation = useApproveDrafts({
    viewMode,
    onSuccess: (messageIds) => {
      setSelectedDrafts(new Set())
      showSuccess(`Successfully approved ${messageIds.length} draft(s)`)
    },
    onError: (error) => {
      console.error('Error approving drafts:', error)
      showError(error.message || 'Failed to approve drafts')
    }
  })

  const rejectMutation = useRejectDrafts({
    viewMode,
    onSuccess: (messageIds) => {
      setSelectedDrafts(new Set())
      showSuccess(`Successfully rejected ${messageIds.length} draft(s)`)
    },
    onError: (error) => {
      console.error('Error rejecting drafts:', error)
      showError(error.message || 'Failed to reject drafts')
    }
  })

  const totalDrafts = draftGroups.reduce((sum, group) => sum + group.messages.length, 0)
  const allDraftIds = draftGroups.flatMap(group => group.messages.map(m => m.id))
  const allSelected = allDraftIds.length > 0 && allDraftIds.every(id => selectedDrafts.has(id))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedDrafts(new Set())
    } else {
      setSelectedDrafts(new Set(allDraftIds))
    }
  }

  const toggleSelectDraft = (draftId: string) => {
    setSelectedDrafts(prev => {
      const next = new Set(prev)
      if (next.has(draftId)) {
        next.delete(draftId)
      } else {
        next.add(draftId)
      }
      return next
    })
  }

  const handleBulkApprove = () => {
    if (selectedDrafts.size === 0) return
    approveMutation.mutate({ messageIds: Array.from(selectedDrafts) })
  }

  const handleBulkReject = () => {
    if (selectedDrafts.size === 0) return

    if (!confirm(`Are you sure you want to reject ${selectedDrafts.size} draft(s)?`)) {
      return
    }

    rejectMutation.mutate({ messageIds: Array.from(selectedDrafts) })
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Draft Messages</h2>
          <div className="text-sm text-muted-foreground">
            {totalDrafts} draft{totalDrafts !== 1 ? 's' : ''} pending approval
          </div>
        </div>

        {/* Bulk Actions */}
        {totalDrafts > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm cursor-pointer">
                Select All ({selectedDrafts.size} selected)
              </label>
            </div>

            {selectedDrafts.size > 0 && (
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Approving...
                    </>
                  ) : (
                    `Approve ${selectedDrafts.size}`
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkReject}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Rejecting...
                    </>
                  ) : (
                    `Reject ${selectedDrafts.size}`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Draft List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : totalDrafts === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground text-sm">No draft messages pending approval</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {draftGroups.map((group) => (
              <div
                key={group.conversationId}
                className="bg-card border border-border rounded-lg p-4"
              >
                {/* Conversation Header */}
                <div
                  className="flex items-center gap-3 mb-3 pb-3 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors rounded-lg -mx-2 -mt-2 px-2 pt-2"
                  onClick={() => onConversationClick?.(group.conversationId)}
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{group.clientName}</h3>
                    <p className="text-sm text-muted-foreground">{group.clientPhone}</p>
                    <p className="text-xs text-muted-foreground">Agent: {group.agentName}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {group.messages.length} draft{group.messages.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Draft Messages */}
                <div className="space-y-3">
                  {group.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border-2 transition-colors",
                        selectedDrafts.has(message.id)
                          ? "bg-yellow-50 border-yellow-400"
                          : "bg-yellow-50/50 border-yellow-300"
                      )}
                    >
                      <Checkbox
                        checked={selectedDrafts.has(message.id)}
                        onCheckedChange={() => toggleSelectDraft(message.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        {message.metadata?.automated && (
                          <div className="text-xs text-yellow-800 font-semibold mb-1">
                            Automated: {message.metadata.type?.replace('_', ' ').toUpperCase()}
                          </div>
                        )}
                        <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                          {message.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
