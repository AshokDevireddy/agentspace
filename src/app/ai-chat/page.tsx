'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { Sparkles, Send, Loader2, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CodeExecutor from '@/components/ai/CodeExecutor';
import ThinkingProgress from '@/components/ai/ThinkingProgress';
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  chartCode?: string;
  chartData?: any;
}

interface ToolCall {
  id: string;
  name: string;
  input: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

interface ToolResult {
  tool_use_id: string;
  tool_name: string;
  result: any;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
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
          .select('is_admin')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (error || !userData || !userData.is_admin) {
          router.push('/unauthorized');
        } else {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        router.push('/unauthorized');
      }
    };

    checkAdmin();
  }, [user, loading, router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, thinkingSteps, currentToolCalls]);

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
      'get_persistency_analytics': 'Analyzing persistency data',
      'get_conversations_data': 'Getting conversation data',
      'get_carriers_and_products': 'Loading carriers and products',
      'get_agency_summary': 'Generating agency summary'
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
        const carriers = formatNumber(result.carriers?.length);
        const persistency = formatPercent(result.overall_analytics?.overallPersistency);
        return `Persistency across ${carriers || 'agency'} carriers${persistency ? ` • overall ${persistency}` : ''}`;
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
        throw new Error('Failed to get response');
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
      if (chartCode) {
        // Try to find the most recent tool result
        const lastToolResult = Array.from(toolResultsMap.values()).pop();
        chartData = lastToolResult;
      }

      const finalMessage: Message = {
        role: 'assistant',
        content: cleanContent,
        toolCalls: Array.from(currentToolCallsMap.values()),
        chartCode: chartCode || undefined,
        chartData: chartData
      };

      setMessages(prev => [...prev, finalMessage]);
      setCurrentToolCalls([]);
      setThinkingSteps([]);
      setStreamingContent('');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Show loading spinner while auth is loading or admin check is in progress
  if (loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50 overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="fixed top-0 left-0 right-0 z-10 backdrop-blur-xl bg-white/80 shadow-sm lg:left-64">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center">
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
                <p className="text-xs text-slate-600">
                  * AI can make mistakes. Please verify important information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pt-20 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 shadow-2xl shadow-purple-500/40 mb-6">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
                Welcome to AI Mode
              </h2>
              <p className="text-slate-600 text-lg mb-12 max-w-2xl mx-auto">
                I can help you analyze your agency data, generate insights, and create custom visualizations.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <button
                  onClick={() => setInput('Show me our top performing agents this month')}
                  className="group p-5 text-left bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-purple-100 hover:border-purple-300 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 group-hover:text-purple-600 transition-colors">Top Performers</div>
                  <div className="text-sm text-slate-500">See your best agents</div>
                </button>
                <button
                  onClick={() => setInput('What is our persistency rate by carrier?')}
                  className="group p-5 text-left bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-blue-100 hover:border-blue-300 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 group-hover:text-blue-600 transition-colors">Persistency Analysis</div>
                  <div className="text-sm text-slate-500">Analyze retention rates</div>
                </button>
                <button
                  onClick={() => setInput('Show me a graph of deal statuses')}
                  className="group p-5 text-left bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-purple-100 hover:border-purple-300 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 group-hover:text-purple-600 transition-colors">Deal Status Overview</div>
                  <div className="text-sm text-slate-500">Visualize your pipeline</div>
                </button>
                <button
                  onClick={() => setInput('Give me an agency summary')}
                  className="group p-5 text-left bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-blue-100 hover:border-blue-300 transition-all duration-200"
                >
                  <div className="font-semibold mb-1 text-slate-800 group-hover:text-blue-600 transition-colors">Agency Summary</div>
                  <div className="text-sm text-slate-500">Get key metrics</div>
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-200'
                  : 'bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg shadow-slate-100'
              } rounded-3xl px-6 py-4`}>
                {message.role === 'user' ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                ) : (
                  <>
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {message.toolCalls.map((toolCall) => (
                          <div key={toolCall.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                            <button
                              onClick={() => toggleToolExpanded(toolCall.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100/70 transition-colors text-left"
                            >
                              {toolCall.status === 'completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin text-purple-600 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium flex-1 text-slate-700">{getToolDisplayName(toolCall.name)}</span>
                              {expandedTools.has(toolCall.id) ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </button>
                            {expandedTools.has(toolCall.id) && toolCall.result && (
                              <div className="px-4 py-3 bg-slate-100/50 border-t border-slate-200">
                                <pre className="text-xs overflow-auto max-h-64 text-slate-600">
                                  {JSON.stringify(toolCall.result, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {message.content && (
                      <div className="prose prose-slate prose-sm max-w-none text-slate-800 leading-relaxed
                        prose-headings:font-bold prose-headings:text-slate-900 prose-headings:mb-3 prose-headings:mt-6 first:prose-headings:mt-0
                        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                        prose-p:text-slate-700 prose-p:leading-7 prose-p:mb-4
                        prose-ul:list-disc prose-ul:ml-4 prose-ul:mb-4 prose-ul:space-y-1.5
                        prose-ol:list-decimal prose-ol:ml-4 prose-ol:mb-4 prose-ol:space-y-1.5
                        prose-li:text-slate-700 prose-li:leading-relaxed
                        prose-strong:text-slate-900 prose-strong:font-semibold
                        prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                        prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:p-4
                        prose-blockquote:border-l-4 prose-blockquote:border-purple-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600
                        prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline
                        prose-table:border-collapse prose-table:w-full prose-table:text-sm
                        prose-th:border prose-th:border-slate-300 prose-th:bg-slate-100 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
                        prose-td:border prose-td:border-slate-300 prose-td:px-4 prose-td:py-2
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
              <div className="max-w-[85%] bg-white/90 backdrop-blur-sm border border-slate-200 rounded-3xl px-6 py-4 shadow-lg shadow-slate-100">
                {thinkingSteps.length > 0 && (
                  <div className="mb-4">
                    <ThinkingProgress steps={thinkingSteps} />
                  </div>
                )}
                {streamingContent && (
                  <div className="prose prose-slate prose-sm max-w-none text-slate-800 leading-relaxed
                    prose-headings:font-bold prose-headings:text-slate-900 prose-headings:mb-3 prose-headings:mt-6 first:prose-headings:mt-0
                    prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                    prose-p:text-slate-700 prose-p:leading-7 prose-p:mb-4
                    prose-ul:list-disc prose-ul:ml-4 prose-ul:mb-4 prose-ul:space-y-1.5
                    prose-ol:list-decimal prose-ol:ml-4 prose-ol:mb-4 prose-ol:space-y-1.5
                    prose-li:text-slate-700 prose-li:leading-relaxed
                    prose-strong:text-slate-900 prose-strong:font-semibold
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

      {/* Input - Floating at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none lg:left-64">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="relative pointer-events-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your agency..."
              disabled={isLoading}
              className="w-full h-14 pl-5 pr-14 text-base rounded-2xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 shadow-2xl bg-white backdrop-blur-sm transition-all"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-300 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
