"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Phone, User, Building, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotification } from '@/contexts/notification-context'

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
  const [clientNameSearch, setClientNameSearch] = useState("")
  const [clientPhoneSearch, setClientPhoneSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmCreate, setConfirmCreate] = useState(false)

  // Debounced search function
  const performSearch = useCallback(async (name: string, phone: string) => {
    // Don't search if both fields are empty
    if (!name.trim() && !phone.trim()) {
      setSearchResults([])
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (name.trim()) params.append('client_name', name.trim())
      if (phone.trim()) params.append('client_phone', phone.trim())
      params.append('limit', '20')

      const response = await fetch(`/api/deals/search-for-conversation?${params.toString()}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to search deals')
      }

      const data = await response.json()
      setSearchResults(data.deals || [])
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(clientNameSearch, clientPhoneSearch)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [clientNameSearch, clientPhoneSearch, performSearch])

  const handleDealSelect = async (deal: Deal) => {
    try {
      setSelectedDeal(deal)
      setCreating(true)

      // Check if conversation already exists
      const response = await fetch('/api/sms/conversations/get-or-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ dealId: deal.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to check conversation')
      }

      const data = await response.json()

      if (data.exists) {
        // Conversation already exists, open it
        onConversationCreated(data.conversationId)
        handleClose()
      } else {
        // Show confirmation dialog
        setConfirmCreate(true)
      }
    } catch (error) {
      console.error('Error checking conversation:', error)
      showError(error instanceof Error ? error.message : 'Failed to check conversation')
      setSelectedDeal(null)
    } finally {
      setCreating(false)
    }
  }

  const handleCreateConversation = async () => {
    if (!selectedDeal) return

    try {
      setCreating(true)

      const response = await fetch('/api/sms/conversations/get-or-create', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          dealId: selectedDeal.id,
          agentId: selectedDeal.agentId // Use the deal's agent_id
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create conversation')
      }

      const data = await response.json()
      onConversationCreated(data.conversationId)
      handleClose()
    } catch (error) {
      console.error('Error creating conversation:', error)
      showError(error instanceof Error ? error.message : 'Failed to create conversation')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setClientNameSearch("")
    setClientPhoneSearch("")
    setSearchResults([])
    setSelectedDeal(null)
    setConfirmCreate(false)
    onOpenChange(false)
  }

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

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
                    onChange={(e) => setClientNameSearch(e.target.value)}
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
                    onChange={(e) => setClientPhoneSearch(e.target.value)}
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
                  {searchResults.map((deal) => (
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
                onClick={() => setConfirmCreate(false)}
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
