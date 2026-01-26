"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Phone, User, Building, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotification } from '@/contexts/notification-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { useCheckConversation, useCreateConversation } from '@/hooks/mutations'
import { formatPhoneForDisplay } from "@/lib/telnyx"

interface Deal {
  id: string
  agentId: string
  clientName: string
  clientPhone: string
  carrier: string
  product: string
  policyNumber: string
  status: string
  agent: string
}

interface CreateConversationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConversationCreated: (conversationId: string) => void
}

export function CreateConversationModal({
  open,
  onOpenChange,
  onConversationCreated,
}: CreateConversationModalProps) {
  const { showSuccess, showError } = useNotification()
  const queryClient = useQueryClient()

  const [clientNameSearch, setClientNameSearch] = useState("")
  const [clientPhoneSearch, setClientPhoneSearch] = useState("")
  const [debouncedNameSearch, setDebouncedNameSearch] = useState("")
  const [debouncedPhoneSearch, setDebouncedPhoneSearch] = useState("")
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [pauseSearch, setPauseSearch] = useState(false)

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNameSearch(clientNameSearch)
      setDebouncedPhoneSearch(clientPhoneSearch)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [clientNameSearch, clientPhoneSearch])

  // Search deals query
  const { data: searchData, isLoading: loading } = useQuery({
    queryKey: queryKeys.searchDeals(debouncedNameSearch.trim(), debouncedPhoneSearch.trim()),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()
      if (debouncedNameSearch.trim()) params.append('client_name', debouncedNameSearch.trim())
      if (debouncedPhoneSearch.trim()) params.append('client_phone', debouncedPhoneSearch.trim())
      params.append('limit', '20')

      const response = await fetch(`/api/deals/search-for-conversation?${params.toString()}`, {
        credentials: 'include',
        signal
      })

      if (!response.ok) {
        throw new Error('Failed to search deals')
      }

      const data = await response.json()
      return data.deals || []
    },
    enabled: !pauseSearch && !!(debouncedNameSearch.trim() || debouncedPhoneSearch.trim()),
    staleTime: 30000, // 30 seconds
  })

  const searchResults = searchData || []

  // Check if conversation exists mutation - using centralized hook
  const checkConversationMutation = useCheckConversation({
    onExists: (conversationId) => {
      // Conversation already exists, open it
      onConversationCreated(conversationId)
      handleClose()
    },
    onNotExists: () => {
      // Show confirmation dialog
      setConfirmCreate(true)
    },
    onError: (error) => {
      console.error('Error checking conversation:', error)
      showError(error.message || 'Failed to check conversation')
      setSelectedDeal(null)
    }
  })

  // Create conversation mutation - using centralized hook
  const createConversationMutation = useCreateConversation({
    onSuccess: (data) => {
      onConversationCreated(data.conversationId)
      handleClose()
    },
    onError: (error) => {
      console.error('Error creating conversation:', error)
      showError(error.message || 'Failed to create conversation')
    }
  })

  const handleDealSelect = (deal: Deal) => {
    setPauseSearch(true) // Pause search to prevent stale results from appearing
    setSelectedDeal(deal)
    checkConversationMutation.mutate(deal.id)
  }

  const handleCreateConversation = () => {
    if (!selectedDeal) return
    createConversationMutation.mutate({ dealId: selectedDeal.id, agentId: selectedDeal.agentId })
  }

  const handleClose = () => {
    setClientNameSearch("")
    setClientPhoneSearch("")
    setDebouncedNameSearch("")
    setDebouncedPhoneSearch("")
    setSelectedDeal(null)
    setConfirmCreate(false)
    setPauseSearch(false)
    onOpenChange(false)
  }

  const formatPhoneNumber = formatPhoneForDisplay

  const creating = checkConversationMutation.isPending || createConversationMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        {!confirmCreate ? (
          <>
            <DialogHeader>
              <DialogTitle>Create New Conversation</DialogTitle>
              <DialogDescription>
                Search for a client by name or phone number to start a conversation
              </DialogDescription>
            </DialogHeader>

            {/* Search Inputs */}
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Client Name
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by name..."
                    value={clientNameSearch}
                    onChange={(e) => {
                      setClientNameSearch(e.target.value)
                      setPauseSearch(false)
                    }}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Client Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by phone..."
                    value={clientPhoneSearch}
                    onChange={(e) => {
                      setClientPhoneSearch(e.target.value)
                      setPauseSearch(false)
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto border rounded-lg min-h-[300px] max-h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Searching...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm">
                    {!clientNameSearch && !clientPhoneSearch
                      ? 'Enter a name or phone number to search'
                      : 'No deals found. Try adjusting your search.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {searchResults.map((deal: Deal) => (
                    <div
                      key={deal.id}
                      onClick={() => handleDealSelect(deal)}
                      className={cn(
                        "p-4 cursor-pointer hover:bg-accent/50 transition-colors",
                        creating && selectedDeal?.id === deal.id && "opacity-50 pointer-events-none"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-foreground">{deal.clientName}</h3>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{formatPhoneNumber(deal.clientPhone)}</span>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Building className="h-3 w-3" />
                              <span>{deal.carrier}</span>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Package className="h-3 w-3" />
                              <span>{deal.product}</span>
                            </div>

                            {deal.policyNumber && (
                              <div className="text-muted-foreground">
                                <span className="font-medium">Policy:</span> {deal.policyNumber}
                              </div>
                            )}
                          </div>

                          <div className="mt-2 text-xs text-muted-foreground">
                            Agent: {deal.agent}
                          </div>
                        </div>

                        {creating && selectedDeal?.id === deal.id && (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create Conversation?</DialogTitle>
              <DialogDescription>
                No conversation exists for this client. Would you like to create one?
              </DialogDescription>
            </DialogHeader>

            {selectedDeal && (
              <div className="py-4 space-y-2">
                <div className="p-4 bg-accent/30 rounded-lg">
                  <h3 className="font-semibold text-foreground mb-2">{selectedDeal.clientName}</h3>
                  <p className="text-sm text-muted-foreground">Phone: {formatPhoneNumber(selectedDeal.clientPhone)}</p>
                  <p className="text-sm text-muted-foreground">Carrier: {selectedDeal.carrier}</p>
                  <p className="text-sm text-muted-foreground">Product: {selectedDeal.product}</p>
                  <p className="text-sm text-muted-foreground">Agent: {selectedDeal.agent}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmCreate(false)
                  setPauseSearch(false)
                  setSelectedDeal(null)
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateConversation}
                disabled={creating}
                className="btn-gradient"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Conversation'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
