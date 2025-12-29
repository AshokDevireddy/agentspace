'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onNewConversation: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isCollapsed,
  onToggleCollapse,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/ai/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Refresh conversations when a new conversation is created
  useEffect(() => {
    if (currentConversationId) {
      fetchConversations();
    }
  }, [currentConversationId]);

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(conversationId);
    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          onSelectConversation(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-background border-r flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="mb-4"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewConversation}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-background border-r flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Conversations</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewConversation}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No conversations yet.
            <br />
            Start a new conversation!
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={cn(
                  'w-full text-left p-2 rounded-md text-sm group relative',
                  'hover:bg-accent transition-colors',
                  currentConversationId === conversation.id && 'bg-accent'
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate pr-6">
                      {conversation.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(conversation.updated_at)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(conversation.id, e)}
                  className={cn(
                    'h-6 w-6 absolute right-1 top-1/2 -translate-y-1/2',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    deletingId === conversation.id && 'opacity-100'
                  )}
                >
                  {deletingId === conversation.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  )}
                </Button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Conversation Button */}
      <div className="p-3 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={onNewConversation}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>
    </div>
  );
}
