'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { Sparkles, Send, Loader2, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CodeExecutor from '@/components/ai/CodeExecutor';
import ThinkingProgress from '@/components/ai/ThinkingProgress';
import { ConversationSidebar } from '@/components/ai/ConversationSidebar';
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChartData {
  data?: Record<string, unknown>[];
  x_axis_key?: string;
  y_axis_keys?: string[];
  [key: string]: unknown;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  chartCode?: string;
  chartData?: ChartData | null;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: Record<string, unknown>;
}

interface ToolResult {
  tool_use_id: string;
  tool_name: string;
  result: Record<string, unknown>;
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
  chart_code?: string;
  chart_data?: ChartData | null;
}

interface ThinkingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
  caption?: string;
  details?: string[];
}

export default function AIChat() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Conversation management state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check Expert tier subscription (AI Mode is available to all Expert tier users)
  useEffect(() => {
    const checkAccess = async () => {
      if (loading) {
        return;
      }

      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const supabase = createClient();
        const { data: userData, error } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (error || !userData) {
          router.push('/unauthorized');
        } else if (userData.subscription_tier !== 'expert') {
          // Show upgrade prompt instead of redirecting
          setNeedsUpgrade(true);
        } else {
          setHasAccess(true);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        router.push('/unauthorized');
      }
    };

    checkAccess();
  }, [user, loading, router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, thinkingSteps, currentToolCalls]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight (content height) but cap at max-height
      const maxHeight = 200;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      // Only show overflow scroll when content exceeds max height
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [input]);

  // Load conversation when selected
  useEffect(() => {
    const loadConversation = async () => {
      if (!currentConversationId) {
        setMessages([]);
        return;
      }

      try {
        const response = await fetch(`/api/ai/conversations/${currentConversationId}`);
        if (response.ok) {
          const data = await response.json();
          // Convert stored messages to Message format
          const loadedMessages: Message[] = (data.messages || []).map((msg: StoredMessage) => ({
            role: msg.role,
            content: msg.content,
            toolCalls: msg.tool_calls,
            chartCode: msg.chart_code,
            chartData: msg.chart_data,
          }));
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      }
    };

    loadConversation();
  }, [currentConversationId]);

  // Handle selecting a conversation
  const handleSelectConversation = (conversationId: string | null) => {
    setCurrentConversationId(conversationId);
  };

  // Handle creating a new conversation
  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  // Save message to database
  const saveMessage = async (conversationId: string, message: Message) => {
    try {
      await fetch(`/api/ai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          tool_calls: message.toolCalls || null,
          chart_code: message.chartCode || null,
          chart_data: message.chartData || null,
        }),
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  // Create a new conversation
  const createConversation = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.conversation?.id || null;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
    return null;
  };

  const toggleToolExpanded = (toolId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const getToolDisplayName = (toolName: string): string => {
    const names: Record<string, string> = {
      'get_deals': 'Retrieving deals data',
      'get_agents': 'Fetching agent information',
      'get_persistency_analytics': 'Loading comprehensive analytics',
      'get_conversations_data': 'Getting conversation data',
      'get_carriers_and_products': 'Loading carriers and products',
      'get_agency_summary': 'Generating agency summary',
      'create_visualization': 'Creating visualization'
    };
    return names[toolName] || toolName;
  };

  const formatNumber = (value: number | null | undefined): string | null => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return new Intl.NumberFormat('en-US').format(Math.round(Number(value)));
  };

  const formatCurrency = (value: number | null | undefined): string | null => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Number(value));
  };

  const formatPercent = (value: number | null | undefined): string | null => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    const normalized = value > 1 ? value : value * 100;
    return `${normalized.toFixed(1)}%`;
  };

  const summarizeValue = (value: any, depth = 0): string => {
    if (depth > 2) {
      return '…';
    }
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
      return value.length > 40 ? `${value.slice(0, 40)}…` : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const preview = value.slice(0, 3).map(item => summarizeValue(item, depth + 1)).join(', ');
      return `[${preview}${value.length > 3 ? ', …' : ''}]`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      const preview = keys.slice(0, 3)
        .map(key => `${key}: ${summarizeValue(value[key], depth + 1)}`)
        .join(', ');
      return `{${preview}${keys.length > 3 ? ', …' : ''}}`;
    }
    return String(value);
  };

  const describeToolInput = (toolName: string, input: Record<string, any> | undefined): string | null => {
    if (!input || typeof input !== 'object') {
      return null;
    }

    const entries = Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '' && !(typeof value === 'object' && Object.keys(value).length === 0));
    if (entries.length === 0) {
      return 'Using default parameters.';
    }

    const formatted = entries
      .map(([key, value]) => `${key}: ${summarizeValue(value)}`)
      .join(', ');

    return `Parameters → ${formatted}`;
  };

  const summarizeToolResultForStep = (toolName: string, result: any): string | null => {
    if (!result || typeof result !== 'object') {
      return null;
    }

    switch (toolName) {
      case 'get_deals': {
        const count = formatNumber(result.count);
        const sample = formatNumber(result.deals?.length);
        const total = formatCurrency(result.summary?.total_annual_premium);
        const parts = [count ? `${count} deals` : 'Deals loaded'];
        if (sample && result.deals?.length !== result.count) {
          parts.push(`${sample} shown`);
        }
        if (total) {
          parts.push(`total premium ${total}`);
        }
        return parts.join(' • ');
      }
      case 'get_agents': {
        const count = formatNumber(result.count);
        const prod = formatCurrency(result.summary?.total_production);
        const policies = formatNumber(result.summary?.total_policies);
        const parts = [count ? `${count} agents` : 'Agents loaded'];
        if (prod) parts.push(`production ${prod}`);
        if (policies) parts.push(`${policies} policies`);
        return parts.join(' • ');
      }
      case 'get_persistency_analytics': {
        const carriers = formatNumber(result.meta?.carriers?.length || result.carriers?.length);
        const totalActive = formatNumber(result.totals?.all?.active);
        const totalSubmitted = formatNumber(result.totals?.all?.submitted);
        const persistency = formatPercent(result.totals?.all?.persistency || result.overall_analytics?.overallPersistency);
        const parts = [];
        if (carriers) parts.push(`${carriers} carriers`);
        if (totalSubmitted) parts.push(`${totalSubmitted} submitted`);
        if (totalActive) parts.push(`${totalActive} active`);
        if (persistency) parts.push(`${persistency} persistency`);
        return parts.length > 0 ? `Analytics: ${parts.join(' • ')}` : 'Analytics data loaded';
      }
      case 'get_conversations_data': {
        const total = formatNumber(result.summary?.total_conversations);
        const active = formatNumber(result.summary?.active_conversations);
        return `Conversations: ${total || '0'} total${active ? ` • ${active} active` : ''}`;
      }
      case 'get_agency_summary': {
        const total = formatCurrency(result.metrics?.total_production);
        const policies = formatNumber(result.metrics?.total_policies);
        return `Agency snapshot${total ? ` • production ${total}` : ''}${policies ? ` • ${policies} policies` : ''}`;
      }
      case 'get_data_summary': {
        if (result.summary_only) {
          const count = formatNumber(result.total_count);
          return `Large dataset detected • approx. ${count || '0'} records summarized`;
        }
        const count = formatNumber(result.total_count);
        const avg = formatCurrency(result.summary?.average_premium ?? result.summary?.average_production);
        return `Summary over ${count || '0'} records${avg ? ` • average ${avg}` : ''}`;
      }
      case 'create_visualization': {
        if (result._visualization) {
          const chartType = result.chart_type || 'chart';
          const dataCount = formatNumber(result.data?.length);
          return `Generated ${chartType} visualization${dataCount ? ` with ${dataCount} data points` : ''}`;
        }
        return 'Visualization created';
      }
      default: {
        const keys = Object.keys(result);
        if (keys.length === 0) return 'Received empty result.';
        return `Received data keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}`;
      }
    }
  };

  const extractChartCode = (content: string): { cleanContent: string; chartCode: string | null } => {
    // Look for ```chartcode blocks
    const chartCodeRegex = /```chartcode\n([\s\S]*?)```/g;
    const match = chartCodeRegex.exec(content);

    if (match) {
      const chartCode = match[1];
      const cleanContent = content.replace(chartCodeRegex, '').trim();
      return { cleanContent, chartCode };
    }

    return { cleanContent: content, chartCode: null };
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setThinkingSteps([]);
    setCurrentToolCalls([]);

    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Create conversation if this is the first message
    let activeConversationId = currentConversationId;
    if (!activeConversationId) {
      activeConversationId = await createConversation();
      if (activeConversationId) {
        setCurrentConversationId(activeConversationId);
      }
    }

    // Save user message to database
    if (activeConversationId) {
      await saveMessage(activeConversationId, userMessage);
    }

    try {
      const conversationMessages = [
        ...messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        {
          role: 'user',
          content: userMessage.content
        }
      ];

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationMessages
        }),
      });

      if (!response.ok) {
        // Try to parse error response
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let assistantMessage = '';
      let currentToolCallsMap = new Map<string, ToolCall>();
      let currentThinkingSteps: ThinkingStep[] = [];
      let toolResultsMap = new Map<string, any>();
      let buffer = '';

      const syncThinkingStepsState = () => {
        setThinkingSteps([...currentThinkingSteps]);
      };

      const addStep = (step: ThinkingStep) => {
        currentThinkingSteps = [...currentThinkingSteps, step];
        syncThinkingStepsState();
      };

      const updateStep = (id: string, updater: (step: ThinkingStep) => ThinkingStep) => {
        let changed = false;
        currentThinkingSteps = currentThinkingSteps.map(step => {
          if (step.id !== id) {
            return step;
          }
          changed = true;
          return updater(step);
        });
        if (changed) {
          syncThinkingStepsState();
        }
      };

      const appendStepDetail = (id: string, detail: string | null | undefined) => {
        if (!detail) return;
        updateStep(id, step => {
          const existing = step.details || [];
          if (existing.includes(detail)) {
            return step;
          }
          return {
            ...step,
            details: [...existing, detail],
          };
        });
      };

      const ensureDraftingStep = () => {
        const existing = currentThinkingSteps.find(step => step.id === 'drafting');
        if (existing) {
          if (existing.status !== 'completed') {
            updateStep('drafting', step => ({ ...step, status: 'in_progress' }));
          }
          return;
        }
        addStep({
          id: 'drafting',
          label: 'Composing response',
          status: 'in_progress',
          details: ['Drafting a polished answer.'],
        });
      };

      const handleEvent = (event: any) => {
        if (event.type === 'message_start') {
          currentThinkingSteps = [{
            id: 'analysis',
            label: 'Understanding your request',
            status: 'in_progress',
            details: ['Reviewing your instructions and available context.'],
          }];
          syncThinkingStepsState();
          return;
        }

        if (event.type === 'content_block_start') {
          if (event.content_block?.type === 'text') {
            updateStep('analysis', step => ({ ...step, status: 'completed' as const }));
            appendStepDetail('analysis', 'Finished identifying relevant datasets.');
            ensureDraftingStep();
          } else if (event.content_block?.type === 'tool_use') {
            const toolCall: ToolCall = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: event.content_block.input ?? {},
              status: 'running'
            };
            currentToolCallsMap.set(toolCall.id, toolCall);
            setCurrentToolCalls(Array.from(currentToolCallsMap.values()));

            addStep({
              id: toolCall.id,
              label: getToolDisplayName(toolCall.name),
              caption: toolCall.name,
              status: 'in_progress',
              details: ['Executing data request...'],
            });

            const paramsDetail = describeToolInput(toolCall.name, toolCall.input);
            if (paramsDetail) {
              appendStepDetail(toolCall.id, paramsDetail);
            }
          }
          return;
        }

        if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            assistantMessage += event.delta.text;
            setStreamingContent(assistantMessage);
          }
          return;
        }

        if (event.type === 'tool_result') {
          const toolCall = currentToolCallsMap.get(event.tool_use_id);
          if (toolCall) {
            toolCall.status = 'completed';
            toolCall.result = event.result;
            currentToolCallsMap.set(toolCall.id, toolCall);
            setCurrentToolCalls(Array.from(currentToolCallsMap.values()));

            toolResultsMap.set(toolCall.name, event.result);

            const summary = summarizeToolResultForStep(toolCall.name, event.result);
            if (summary) {
              appendStepDetail(toolCall.id, summary);
            }

            updateStep(toolCall.id, step => ({ ...step, status: 'completed' as const }));
          }
          return;
        }

        if (event.type === 'message_delta') {
          if (event.delta?.stop_reason) {
            ensureDraftingStep();
            appendStepDetail('drafting', 'Response ready to send.');
            currentThinkingSteps = currentThinkingSteps.map(step => ({
              ...step,
              status: 'completed' as const
            }));
            syncThinkingStepsState();
          }
          return;
        }
      };

      const processBuffer = (isFinal = false) => {
        const segments = buffer.split(/\r?\n/);
        if (!isFinal) {
          buffer = segments.pop() ?? '';
        } else {
          buffer = '';
        }

        for (const segment of segments) {
          const trimmed = segment.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trimStart();
          if (payload === '[DONE]') continue;
          try {
            const event = JSON.parse(payload);
            handleEvent(event);
          } catch (e) {
            console.error('Error parsing event:', e);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          processBuffer(true);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        processBuffer(false);
      }

      // Extract chart code if present
      const { cleanContent, chartCode } = extractChartCode(assistantMessage);

      // Get the most relevant data for chart rendering
      let chartData = null;
      let finalChartCode = chartCode;

      // Check if any tool result is a visualization (from create_visualization tool)
      const toolResults = Array.from(toolResultsMap.values());
      interface VisualizationToolResult {
        _visualization?: boolean;
        chartcode?: string;
        data?: Record<string, unknown>[] | { sample?: Record<string, unknown>[] };
        _axis_metadata?: { x_axis_key?: string; y_axis_keys?: string[] };
      }
      const visualizationResult = toolResults.find(
        (result): result is VisualizationToolResult =>
          result?._visualization === true && Boolean(result?.chartcode)
      );

      if (visualizationResult && visualizationResult.chartcode) {
        finalChartCode = visualizationResult.chartcode;

        // Extract data array, handling sanitized format if needed
        let vizData = visualizationResult.data;
        if (vizData && typeof vizData === 'object' && !Array.isArray(vizData) && 'sample' in vizData) {
          vizData = vizData.sample;
        }

        if (Array.isArray(vizData) && vizData.length > 0) {
          chartData = {
            data: vizData,
            x_axis_key: visualizationResult._axis_metadata?.x_axis_key,
            y_axis_keys: visualizationResult._axis_metadata?.y_axis_keys
          };
        }
      } else if (chartCode) {
        // Fall back to extracting from assistant message (legacy behavior)
        const lastToolResult = toolResults.pop();
        chartData = lastToolResult;
      }

      const finalMessage: Message = {
        role: 'assistant',
        content: cleanContent,
        toolCalls: Array.from(currentToolCallsMap.values()),
        chartCode: finalChartCode || undefined,
        chartData: chartData
      };

      setMessages(prev => [...prev, finalMessage]);
      setCurrentToolCalls([]);
      setThinkingSteps([]);
      setStreamingContent('');

      // Save assistant message to database
      if (activeConversationId) {
        await saveMessage(activeConversationId, finalMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
      setThinkingSteps([]);
      setStreamingContent('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Show loading spinner while auth is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show upgrade prompt for non-Expert tier users
  if (needsUpgrade) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 shadow-2xl shadow-purple-500/40 mb-6">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Expert Tier Required
          </h2>
          <p className="text-slate-600 dark:text-gray-400 mb-6">
            AI Mode is an exclusive feature available only with the Expert tier subscription.
            Upgrade your plan to unlock powerful AI-driven analytics and visualizations.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/settings')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Upgrade to Expert
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while checking access
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-gray-900 overflow-hidden ai-mode-content" data-tour="ai-mode">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - fixed height to align border with sidebar */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 shadow-sm border-b border-slate-200 dark:border-gray-700 h-16 flex items-center">
          <div className="max-w-4xl mx-auto px-4 w-full">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    AI Mode
                  </h1>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-300">
                    BETA
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  * AI can make mistakes. Please verify important information.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 shadow-2xl shadow-purple-500/40 mb-6">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
                Welcome to AI Mode
              </h2>
              <p className="text-slate-600 dark:text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
                Create custom visualizations and interactive graphs from your data.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <button
                  onClick={() => setInput('Create a bar graph for the policies sold for each carrier in the last 9 months')}
                  className="group p-5 text-left bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-slate-200 dark:border-gray-700 rounded-2xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-lg hover:shadow-purple-100 dark:hover:shadow-purple-900/30 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Carrier Performance</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">Policies by carrier over time</div>
                </button>
                <button
                  onClick={() => setInput('Show me a line chart of monthly revenue trends')}
                  className="group p-5 text-left bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-slate-200 dark:border-gray-700 rounded-2xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Revenue Trends</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-1">
                    Visualize growth patterns
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">Coming Soon</span>
                  </div>
                </button>
                <button
                  onClick={() => setInput('Create a pie chart showing distribution by product type')}
                  className="group p-5 text-left bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-slate-200 dark:border-gray-700 rounded-2xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-lg hover:shadow-purple-100 dark:hover:shadow-purple-900/30 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Product Distribution</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-1">
                    Compare product mix
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">Coming Soon</span>
                  </div>
                </button>
                <button
                  onClick={() => setInput('Show me a heat map of activity by day and hour')}
                  className="group p-5 text-left bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-slate-200 dark:border-gray-700 rounded-2xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Activity Patterns</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-1">
                    Peak engagement times
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">Coming Soon</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-200 dark:shadow-purple-900/30'
                  : 'bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-slate-200 dark:border-gray-700 shadow-lg shadow-slate-100 dark:shadow-gray-900/30'
              } rounded-3xl px-6 py-4`}>
                {message.role === 'user' ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                ) : (
                  <>
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {message.toolCalls.map((toolCall) => (
                          <div key={toolCall.id} className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-gray-900/50">
                            <button
                              onClick={() => toggleToolExpanded(toolCall.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100/70 dark:hover:bg-gray-800/70 transition-colors text-left"
                            >
                              {toolCall.status === 'completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium flex-1 text-slate-700 dark:text-gray-300">{getToolDisplayName(toolCall.name)}</span>
                              {expandedTools.has(toolCall.id) ? (
                                <ChevronUp className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                              )}
                            </button>
                            {expandedTools.has(toolCall.id) && toolCall.result && (
                              <div className="px-4 py-3 bg-slate-100/50 dark:bg-gray-900/70 border-t border-slate-200 dark:border-gray-700">
                                <pre className="text-xs overflow-auto max-h-64 text-slate-600 dark:text-gray-400">
                                  {JSON.stringify(toolCall.result, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {message.content && (
                      <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-800 dark:text-gray-200 leading-relaxed
                        prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-gray-100 prose-headings:mb-3 prose-headings:mt-6 first:prose-headings:mt-0
                        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                        prose-p:text-slate-700 dark:prose-p:text-gray-300 prose-p:leading-7 prose-p:mb-4
                        prose-ul:list-disc prose-ul:ml-4 prose-ul:mb-4 prose-ul:space-y-1.5
                        prose-ol:list-decimal prose-ol:ml-4 prose-ol:mb-4 prose-ol:space-y-1.5
                        prose-li:text-slate-700 dark:prose-li:text-gray-300 prose-li:leading-relaxed
                        prose-strong:text-slate-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold
                        prose-code:text-purple-600 dark:prose-code:text-purple-400 prose-code:bg-purple-50 dark:prose-code:bg-purple-900/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                        prose-pre:bg-slate-900 dark:prose-pre:bg-gray-950 prose-pre:text-slate-100 dark:prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4
                        prose-blockquote:border-l-4 prose-blockquote:border-purple-500 dark:prose-blockquote:border-purple-600 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-gray-400
                        prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
                        prose-table:border-collapse prose-table:w-full prose-table:text-sm
                        prose-th:border prose-th:border-slate-300 dark:prose-th:border-gray-700 prose-th:bg-slate-100 dark:prose-th:bg-gray-800 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
                        prose-td:border prose-td:border-slate-300 dark:prose-td:border-gray-700 prose-td:px-4 prose-td:py-2
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {message.chartCode && (
                      <div className="mt-6">
                        <CodeExecutor code={message.chartCode} data={message.chartData} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Current streaming response with thinking progress */}
          {(isLoading && (thinkingSteps.length > 0 || streamingContent)) && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-slate-200 dark:border-gray-700 rounded-3xl px-6 py-4 shadow-lg shadow-slate-100 dark:shadow-gray-900/30">
                {thinkingSteps.length > 0 && (
                  <div className="mb-4">
                    <ThinkingProgress steps={thinkingSteps} />
                  </div>
                )}
                {streamingContent && (
                  <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-800 dark:text-gray-200 leading-relaxed
                    prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-gray-100 prose-headings:mb-3 prose-headings:mt-6 first:prose-headings:mt-0
                    prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                    prose-p:text-slate-700 dark:prose-p:text-gray-300 prose-p:leading-7 prose-p:mb-4
                    prose-ul:list-disc prose-ul:ml-4 prose-ul:mb-4 prose-ul:space-y-1.5
                    prose-ol:list-decimal prose-ol:ml-4 prose-ol:mb-4 prose-ol:space-y-1.5
                    prose-li:text-slate-700 dark:prose-li:text-gray-300 prose-li:leading-relaxed
                    prose-strong:text-slate-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold
                  ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

        {/* Input - expands upward, stays anchored at bottom */}
        <div className="flex-shrink-0 min-h-20 border-t border-slate-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl flex items-center">
          <div className="max-w-4xl mx-auto px-4 w-full">
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about your agency..."
                disabled={isLoading}
                rows={1}
                className="flex-1 min-h-[48px] max-h-[200px] px-5 py-3 text-base rounded-3xl border-2 border-slate-200 dark:border-gray-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 shadow-lg bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 backdrop-blur-sm transition-all resize-none focus:outline-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-gray-600"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-300 shadow-lg shadow-purple-300 disabled:shadow-none transition-all flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
