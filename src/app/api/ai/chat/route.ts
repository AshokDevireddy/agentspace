import { createServerClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { executeToolCall } from '@/lib/ai-tools';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define available tools that Claude can use
const tools: Anthropic.Tool[] = [
  {
    name: 'get_deals',
    description: 'Get SPECIFIC deal/policy details for individual records. Returns limited sample (default 100 deals). DO NOT use for analytics, counting policies, or active/inactive analysis - use get_persistency_analytics instead. Only use this when you need specific deal information like client names, individual premiums, or policy numbers.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by deal status (e.g., active, draft, closed, lapsed)',
          enum: ['active', 'draft', 'closed', 'lapsed', 'pending', 'declined', 'all']
        },
        agent_id: { type: 'string', description: 'Filter by specific agent ID' },
        carrier_id: { type: 'string', description: 'Filter by specific carrier ID' },
        start_date: { type: 'string', description: 'Start date for filtering (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date for filtering (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Maximum number of records to return (default 100, WARNING: does not return all deals)' }
      }
    }
  },
  {
    name: 'get_agents',
    description: 'Get agent performance data including total production, policies sold, and hierarchy information.',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Specific agent ID to get details for' },
        include_downlines: { type: 'boolean', description: 'Include downline agents in the hierarchy' },
        top_performers: { type: 'boolean', description: 'Get only top performing agents' },
        limit: { type: 'number', description: 'Maximum number of records to return' }
      }
    }
  },
  {
    name: 'get_conversations_data',
    description: 'Get SMS conversation and messaging data including conversation counts, message volumes, and communication patterns.',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Filter by specific agent ID' },
        date_range_days: { type: 'number', description: 'Number of days to look back (default 30)' },
        include_messages: { type: 'boolean', description: 'Include actual message contents' }
      }
    }
  },
  {
    name: 'get_carriers_and_products',
    description: 'Get information about available carriers and their products.',
    input_schema: {
      type: 'object',
      properties: {
        carrier_id: { type: 'string', description: 'Specific carrier ID' },
        active_only: { type: 'boolean', description: 'Only return active carriers/products (default true)' }
      }
    }
  },
  {
    name: 'get_agency_summary',
    description: 'Get high-level summary statistics for the agency including total production, agent count, policy count, and key metrics.',
    input_schema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          description: 'Time period for metrics (current_month, last_month, ytd, all)',
          enum: ['current_month', 'last_month', 'ytd', 'all']
        }
      }
    }
  },
  {
    name: 'get_persistency_analytics',
    description: 'Get comprehensive persistency analytics including active/inactive policy counts, lapse rates, and status breakdowns by carrier. USE THIS TOOL for any questions about persistency, active/inactive policies, lapse rates, or carrier performance. This provides pre-calculated analytics.',
    input_schema: {
      type: 'object',
      properties: {
        time_range: {
          type: 'string',
          description: 'Optional time range filter (not currently used, data includes all time ranges)',
          enum: ['3', '6', '9', 'All']
        }
      }
    }
  },
  {
    name: 'search_agents',
    description: 'Fuzzy search for agents by name, email, or partial matches. Use this when you need to find specific agents before querying their data. Returns agent IDs and basic info for further queries. Supports partial name matching (e.g., "john" matches "John Smith").',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (at least 2 characters). Can be partial name, email, or combination.' },
        limit: { type: 'number', description: 'Maximum number of results (default 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'search_clients',
    description: 'Fuzzy search for clients by name, email, or phone number. Use this when you need to find specific clients before querying their policies. Returns client IDs and basic info.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (at least 2 characters). Can be partial name, email, or phone.' },
        limit: { type: 'number', description: 'Maximum number of results (default 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'search_policies',
    description: 'Fuzzy search for policies/deals by policy number, application number, or client name. Use this when you need to find specific policies. Returns policy IDs and basic info.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (at least 2 characters). Can be policy number, app number, or client name.' },
        limit: { type: 'number', description: 'Maximum number of results (default 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_agent_hierarchy',
    description: 'Get complete agent hierarchy (upline/downline) with production metrics. Use this to understand agent relationships and analyze hierarchy performance. Returns the root agent, all agents in their downline, and aggregate metrics (total production, total policies, active agents). Use when questions involve hierarchy relationships or comparing upline performance.',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to get hierarchy for (root of the hierarchy)' }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'compare_hierarchies',
    description: 'Compare multiple agent hierarchies side-by-side. Use this to answer questions like "which hierarchy has better production" or "compare upline A vs upline B". Returns production comparisons, agent counts, and performance metrics for each hierarchy. Input should be an array of agent IDs (roots of hierarchies to compare).',
    input_schema: {
      type: 'object',
      properties: {
        agent_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of agent IDs (roots of hierarchies to compare). At least one required.'
        }
      },
      required: ['agent_ids']
    }
  },
  {
    name: 'get_deals_paginated',
    description: 'Get deals/policies with cursor-based pagination. Use this for large datasets that exceed 1000 entries or when you need to fetch data in chunks. Returns deals with a next_cursor for continuation. The LLM can decide when to stop fetching by checking has_more flag. Use this instead of get_deals when dealing with large datasets or when you need to iterate through many records.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by deal status',
          enum: ['active', 'draft', 'closed', 'lapsed', 'pending', 'declined', 'all']
        },
        agent_id: { type: 'string', description: 'Filter by specific agent ID' },
        carrier_id: { type: 'string', description: 'Filter by specific carrier ID' },
        start_date: { type: 'string', description: 'Start date for filtering (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date for filtering (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Maximum number of records per page (default 50, max 200)' },
        cursor: {
          type: 'object',
          description: 'Cursor from previous page for pagination. Include cursor_created_at and cursor_id.',
          properties: {
            cursor_created_at: { type: 'string' },
            cursor_id: { type: 'string' }
          }
        }
      }
    }
  },
  {
    name: 'get_agents_paginated',
    description: 'Get agents with cursor-based pagination. Use this for large agent lists that exceed 1000 entries or when you need to fetch agents in chunks. Returns agents with a next_cursor for continuation. The LLM can decide when to stop fetching by checking has_more flag.',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Filter by specific agent ID' },
        status: { type: 'string', description: 'Filter by agent status' },
        top_performers: { type: 'boolean', description: 'Get only top performing agents' },
        limit: { type: 'number', description: 'Maximum number of records per page (default 50, max 200)' },
        cursor: {
          type: 'object',
          description: 'Cursor from previous page for pagination. Include cursor_id.',
          properties: {
            cursor_id: { type: 'string' }
          }
        }
      }
    }
  },
  {
    name: 'get_data_summary',
    description: 'Get smart summarization of data based on query intent. Automatically detects if dataset exceeds 1000 entries and returns summary statistics instead of full data. Use this for count queries, analytics queries, or when you need aggregated data. For datasets >1000 entries, returns estimated totals based on sampling. For smaller datasets, returns full summary with all data. Use this when you need counts, averages, or breakdowns without fetching all records.',
    input_schema: {
      type: 'object',
      properties: {
        data_type: {
          type: 'string',
          description: 'Type of data to summarize',
          enum: ['deals', 'agents', 'clients']
        },
        summary_type: {
          type: 'string',
          description: 'Type of summary',
          enum: ['counts', 'aggregates', 'breakdown']
        },
        status: { type: 'string', description: 'Filter by status (for deals)' },
        agent_id: { type: 'string', description: 'Filter by agent ID' },
        carrier_id: { type: 'string', description: 'Filter by carrier ID' },
        start_date: { type: 'string', description: 'Start date filter' },
        end_date: { type: 'string', description: 'End date filter' }
      },
      required: ['data_type']
    }
  },
];

const MAX_ARRAY_SAMPLE_ITEMS = 15;
const MAX_STRING_LENGTH = 800;
const MAX_OBJECT_DEPTH = 4;

function truncateStringForLLM(value: string) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}… [truncated ${value.length - MAX_STRING_LENGTH} chars]`;
}

function summarizeTimeRangeEntry(entry: Record<string, any> | null | undefined) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  const relevantKeys = ['positiveCount', 'negativeCount', 'activeCount', 'inactiveCount', 'positivePercentage', 'activePercentage', 'persistencyRate'];

  return relevantKeys.reduce<Record<string, any>>((acc, key) => {
    if (entry[key] !== undefined && entry[key] !== null) {
      acc[key] = entry[key];
    }
    return acc;
  }, {});
}

function summarizeTimeRangesMap(timeRanges: Record<string, any> | null | undefined) {
  if (!timeRanges || typeof timeRanges !== 'object') {
    return timeRanges;
  }

  const priorityOrder = ['All', '12', '9', '6', '3'];
  const keys = Object.keys(timeRanges);
  const orderedKeys = [...new Set([...priorityOrder, ...keys])].filter(key => keys.includes(key));
  const limitedKeys = orderedKeys.slice(0, 4);

  return limitedKeys.reduce<Record<string, any>>((acc, key) => {
    acc[key] = summarizeTimeRangeEntry(timeRanges[key]);
    return acc;
  }, {});
}

function summarizeStatusBreakdowns(breakdowns: Record<string, any> | null | undefined) {
  if (!breakdowns || typeof breakdowns !== 'object') {
    return breakdowns;
  }

  const timeRanges = Object.entries(breakdowns).slice(0, 3);
  return timeRanges.map(([timeRange, statuses]) => {
    if (!statuses || typeof statuses !== 'object') {
      return { timeRange, statuses };
    }

    const orderedStatuses = Object.entries(statuses)
      .map(([status, metrics]) => {
        const metricRecord = (metrics ?? {}) as Record<string, any>;
        const countValue =
          metricRecord.count ?? metricRecord.positiveCount ?? metricRecord.inactiveCount ?? null;
        const percentageValue =
          metricRecord.percentage ?? metricRecord.positivePercentage ?? metricRecord.activePercentage ?? null;

        return {
          status,
          count: countValue,
          percentage: percentageValue,
        };
      })
      .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
      .slice(0, 5);

    return {
      timeRange,
      top_statuses: orderedStatuses,
    };
  });
}

function summarizePersistencyAnalytics(result: any) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const carriers = Array.isArray(result.carriers) ? [...result.carriers] : [];
  const sortedCarriers = carriers.sort((a, b) => (Number(b?.totalPolicies) || 0) - (Number(a?.totalPolicies) || 0));
  const limitedCarriers = sortedCarriers.slice(0, 12).map(carrier => ({
    carrier: carrier?.carrier,
    totalPolicies: carrier?.totalPolicies,
    persistencyRate: carrier?.persistencyRate,
    timeRanges: summarizeTimeRangesMap(carrier?.timeRanges),
    statusHighlights: summarizeStatusBreakdowns(carrier?.statusBreakdowns),
  }));

  return {
    overall: result.overall_analytics
      ? {
          overallPersistency: result.overall_analytics.overallPersistency,
          activeCount: result.overall_analytics.activeCount,
          inactiveCount: result.overall_analytics.inactiveCount,
          timeRanges: summarizeTimeRangesMap(result.overall_analytics.timeRanges),
        }
      : null,
    top_carriers: limitedCarriers,
    total_carriers: carriers.length,
    truncated: carriers.length > limitedCarriers.length,
    note:
      carriers.length > limitedCarriers.length
        ? `Showing top ${limitedCarriers.length} carriers out of ${carriers.length}.`
        : undefined,
    carrier_comparison: result.carrier_comparison ? sanitizeValueForLLM(result.carrier_comparison) : undefined,
  };
}

function sanitizeArrayForLLM(arr: any[], depth: number) {
  if (arr.length === 0) {
    return arr;
  }

  const sampleSize = Math.min(MAX_ARRAY_SAMPLE_ITEMS, arr.length);
  const sample = arr.slice(0, sampleSize).map(item => sanitizeValueForLLM(item, depth + 1));

  const isNumeric = sample.every(item => typeof item === 'number');
  const numericSummary = isNumeric
    ? {
        min: Math.min(...(sample as number[])),
        max: Math.max(...(sample as number[])),
        average: (sample as number[]).reduce((sum, value) => sum + value, 0) / sample.length,
      }
    : undefined;

  return {
    sample,
    total_items: arr.length,
    truncated: arr.length > sampleSize,
    fields: typeof arr[0] === 'object' && arr[0] !== null ? Object.keys(arr[0]) : undefined,
    numeric_summary: numericSummary,
  };
}

function sanitizeValueForLLM(value: any, depth = 0): any {
  if (depth > MAX_OBJECT_DEPTH) {
    return '[max depth reached]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateStringForLLM(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return sanitizeArrayForLLM(value, depth);
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, any>>((acc, [key, val]) => {
      acc[key] = sanitizeValueForLLM(val, depth + 1);
      return acc;
    }, {});
  }

  return value;
}

function sanitizeToolResult(toolName: string, result: any) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  if (result.error) {
    return result;
  }

  switch (toolName) {
    case 'get_persistency_analytics':
      return summarizePersistencyAnalytics(result);
    default:
      return sanitizeValueForLLM(result);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin, agency_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData || !userData.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { messages } = await request.json();

    // System prompt for better formatting
    const systemPrompt = `You are an AI assistant helping analyze insurance agency data. Your responses will be rendered with markdown support, so please format them professionally.

FORMATTING GUIDELINES:
- Use clear headings (# for main title, ## for sections, ### for subsections)
- Use bullet points (-) for lists and insights
- Use **bold** sparingly for key metrics or important terms (not for every heading)
- Keep paragraphs concise and well-spaced
- When presenting insights, use a clear structure:
  1. Start with a brief summary
  2. Break down key findings with headings
  3. Use bullet points for specific insights
  4. End with actionable recommendations if relevant

STYLE GUIDELINES:
- Be conversational but professional
- Avoid excessive use of bold/emphasis
- Use emojis sparingly (only for section headings if it helps clarity)
- Present numbers clearly with proper formatting (e.g., $1,234.56 or 45%)
- When showing statistics, group related items together

VISUALIZATION GUIDELINES - CODE GENERATION:
When the user asks for a chart, graph, or visualization:

1. First, retrieve the necessary data using the appropriate tool (get_deals, get_agents, get_persistency_analytics, etc.)

2. Then, write EXECUTABLE JavaScript/React code to generate the chart. Use this exact format:

\`\`\`chartcode
// Process the data first
const chartData = [
  { name: 'Category 1', value: 100 },
  { name: 'Category 2', value: 200 },
  // ... more data
];

// Define the chart rendering function using React.createElement (NOT JSX)
function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(BarChart, { data: chartData },
      React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
      React.createElement(XAxis, { dataKey: "name", angle: -45, textAnchor: "end", height: 80 }),
      React.createElement(YAxis, null),
      React.createElement(Tooltip, null),
      React.createElement(Legend, null),
      React.createElement(Bar, { dataKey: "value", fill: COLORS[0], radius: [8, 8, 0, 0] })
    )
  );
}
\`\`\`

AVAILABLE COMPONENTS:
- ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area
- XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
- COLORS array with 8 colors
- The 'data' variable contains the tool result you fetched

CHART EXAMPLES (use React.createElement - NOT JSX):

**Stacked Bar Chart:**
\`\`\`chartcode
const chartData = data.carriers.map(carrier => ({
  name: carrier.carrier,
  active: carrier.timeRanges.All.positiveCount,
  inactive: carrier.timeRanges.All.negativeCount
})).slice(0, 10);

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(BarChart, { data: chartData, margin: { bottom: 80, left: 10, right: 10 } },
      React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
      React.createElement(XAxis, { dataKey: "name", angle: -45, textAnchor: "end", height: 100 }),
      React.createElement(YAxis, null),
      React.createElement(Tooltip, null),
      React.createElement(Legend, null),
      React.createElement(Bar, { dataKey: "active", stackId: "a", fill: "#10b981", name: "Active" }),
      React.createElement(Bar, { dataKey: "inactive", stackId: "a", fill: "#ef4444", name: "Inactive" })
    )
  );
}
\`\`\`

**Pie Chart:**
\`\`\`chartcode
const chartData = Object.entries(data.summary.status_breakdown).map(([status, count]) => ({
  name: status,
  value: count
}));

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(PieChart, null,
      React.createElement(Pie, {
        data: chartData,
        dataKey: "value",
        nameKey: "name",
        cx: "50%",
        cy: "50%",
        outerRadius: 120,
        label: true
      },
        chartData.map((entry, index) =>
          React.createElement(Cell, { key: \`cell-\${index}\`, fill: COLORS[index % COLORS.length] })
        )
      ),
      React.createElement(Tooltip, null),
      React.createElement(Legend, null)
    )
  );
}
\`\`\`

**Line Chart:**
\`\`\`chartcode
const chartData = data.agents.slice(0, 10).map(agent => ({
  name: \`\${agent.first_name} \${agent.last_name}\`,
  production: Number(agent.total_prod)
}));

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(LineChart, { data: chartData },
      React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
      React.createElement(XAxis, { dataKey: "name", angle: -45, textAnchor: "end", height: 80 }),
      React.createElement(YAxis, null),
      React.createElement(Tooltip, null),
      React.createElement(Legend, null),
      React.createElement(Line, { type: "monotone", dataKey: "production", stroke: COLORS[0], strokeWidth: 2 })
    )
  );
}
\`\`\`

DATA RETRIEVAL GUIDELINES - CRITICAL:
- For ANYTHING related to persistency, active/inactive policies, lapse rates, policy counts, or carrier performance: ALWAYS use get_persistency_analytics
- get_persistency_analytics provides COMPLETE, pre-calculated data - it has ALL policies already analyzed
- DO NOT use get_deals for analytics or counting policies - it only returns a sample (default 100 deals), NOT all deals
- get_deals is ONLY for showing specific deal details (client names, individual premiums, policy numbers)
- For ANY chart showing active/inactive policies by carrier: ONLY use get_persistency_analytics
- The persistency data already includes ALL carriers with complete active/inactive counts - no need to fetch deals
- If a user asks "how many policies" or "show policies by carrier" → use get_persistency_analytics, NOT get_deals

FUZZY SEARCH GUIDELINES:
- When user asks about specific people (agents/clients) by name but doesn't provide exact IDs: FIRST use search_agents or search_clients
- Use search_agents for finding agents by partial name/email (e.g., "find agent john" → search_agents with query "john")
- Use search_clients for finding clients by partial name/email/phone
- Use search_policies for finding policies by policy number, app number, or client name
- After getting search results, use the returned IDs for further queries (get_agent_hierarchy, get_deals, etc.)
- For group analysis on agents/policies, you may not need fuzzy search - use get_agents or get_deals directly with filters

HIERARCHY ANALYSIS GUIDELINES:
- When user asks about hierarchy relationships, upline/downline performance, or "which hierarchy has better production": use get_agent_hierarchy
- For comparing multiple hierarchies: use compare_hierarchies with array of agent IDs
- Use search_agents first if you need to find agent IDs by name before hierarchy analysis
- Hierarchy tools use get_agent_downline RPC function which respects agency boundaries and user permissions

LARGE DATASET HANDLING:
- When dealing with datasets that might exceed 1000 entries: use get_data_summary first to check size
- For count/analytics queries: use get_data_summary - it automatically summarizes large datasets
- For detailed list queries on large datasets: use get_deals_paginated or get_agents_paginated
- Pagination tools return next_cursor - check has_more flag and decide when to stop fetching
- get_data_summary automatically detects >1000 entries and returns estimates based on sampling
- If summary_only is true in response, dataset exceeds 1000 - use paginated tools for details

TOOL SELECTION DECISION TREE:
1. User asks about specific person (name mentioned, no ID):
   → Use search_agents or search_clients to find ID, then proceed with other tools
2. User asks about hierarchy/relationships:
   → Use get_agent_hierarchy or compare_hierarchies
3. User asks "how many" or "count" or "summary":
   → Use get_data_summary (handles large datasets automatically)
4. User asks for specific policy details or needs to iterate through many records:
   → Use get_deals_paginated (check has_more to decide when to stop)
5. User asks for list of agents (potentially large):
   → Use get_agents_paginated (check has_more to decide when to stop)
6. User asks about persistency/active policies:
   → Use get_persistency_analytics (always)

IMPORTANT:
- Only provide what the user asks for. Do not add extra visualizations, tables, or analysis unless explicitly requested.
- DO NOT create text-based charts or ASCII art - write actual executable code
- The code block MUST use the \`\`\`chartcode language tag for proper detection
- CRITICAL: You MUST use React.createElement() syntax, NOT JSX syntax (no <Component /> tags)
- JSX will NOT work in the execution environment - only React.createElement works

WHEN TO USE EACH TOOL:
✅ get_persistency_analytics: "How many active policies?", "Show policies by carrier", "What's our lapse rate?"
✅ search_agents: "Find agent John", "Show me agents named Smith", "Who is john@email.com?"
✅ get_agent_hierarchy: "Show me John's downline", "What's the production for John's hierarchy?"
✅ compare_hierarchies: "Which hierarchy has better production - John's or Jane's?"
✅ get_data_summary: "How many deals do we have?", "What's the total production?", "Count active agents"
✅ get_deals_paginated: "Show me all active deals" (if >1000), "List deals for agent X" (large dataset)
❌ get_deals: "Show me the client names for Aflac policies", "What premium did client John Doe pay?" (small datasets only)

Remember: Keep it clean, structured, and easy to scan. Only provide what was asked for - no extra visualizations or tables.`;

    // Create a ReadableStream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let conversationMessages = [...messages];
          let shouldContinue = true;

          while (shouldContinue) {
            const messageStream = await anthropic.messages.create({
              model: 'claude-sonnet-4-5',
              max_tokens: 4096,
              system: systemPrompt,
              tools: tools,
              messages: conversationMessages,
              stream: true,
            });

            let currentToolUse: any = null;
            let currentToolInput = '';
            let assistantContent: any[] = [];
            let stopReason = '';
            const toolResultsMap = new Map<string, any>();

            for await (const event of messageStream) {
              // Send the event to the client
              const chunk = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(new TextEncoder().encode(chunk));

              // Handle tool use
              if (event.type === 'content_block_start') {
                if (event.content_block.type === 'tool_use') {
                  currentToolUse = event.content_block;
                  currentToolInput = '';
                  assistantContent.push({
                    type: 'tool_use',
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: {}
                  });
                } else if (event.content_block.type === 'text') {
                  assistantContent.push({
                    type: 'text',
                    text: ''
                  });
                }
              }

              if (event.type === 'content_block_delta') {
                if (event.delta.type === 'input_json_delta') {
                  currentToolInput += event.delta.partial_json;
                } else if (event.delta.type === 'text_delta') {
                  const lastContent = assistantContent[assistantContent.length - 1];
                  if (lastContent && lastContent.type === 'text') {
                    lastContent.text += event.delta.text;
                  }
                }
              }

              if (event.type === 'content_block_stop' && currentToolUse) {
                // Tool use is complete, execute it
                try {
                  // Parse tool input, handling empty/incomplete JSON
                  let toolInput = {};
                  if (currentToolInput && currentToolInput.trim()) {
                    try {
                      toolInput = JSON.parse(currentToolInput);
                    } catch (parseError) {
                      console.error('Error parsing tool input:', currentToolInput, parseError);
                      // Use empty object if JSON is invalid
                      toolInput = {};
                    }
                  }

                  const toolResult = await executeToolCall(
                    currentToolUse.name,
                    toolInput,
                    userData.agency_id
                  );

                  const sanitizedToolResult = sanitizeToolResult(currentToolUse.name, toolResult);

                  // Store tool result
                  toolResultsMap.set(currentToolUse.id, {
                    sanitized: sanitizedToolResult,
                    meta: {
                      tool_name: currentToolUse.name,
                    }
                  });

                  // Update assistant content with parsed input
                  const toolUseContent = assistantContent.find(
                    c => c.type === 'tool_use' && c.id === currentToolUse.id
                  );
                  if (toolUseContent) {
                    toolUseContent.input = toolInput;
                  }

                  // Send tool result back to client
                  const toolResultEvent = {
                    type: 'tool_result',
                    tool_use_id: currentToolUse.id,
                    tool_name: currentToolUse.name,
                    result: toolResult
                  };
                  const resultChunk = `data: ${JSON.stringify(toolResultEvent)}\n\n`;
                  controller.enqueue(new TextEncoder().encode(resultChunk));

                  currentToolUse = null;
                  currentToolInput = '';
                } catch (error) {
                  console.error('Error executing tool:', error);
                }
              }

              if (event.type === 'message_delta' && event.delta.stop_reason) {
                stopReason = event.delta.stop_reason;
              }
            }

            // If we used tools, continue the conversation with tool results
            if (stopReason === 'tool_use') {
              // Add assistant message with tool uses
              conversationMessages.push({
                role: 'assistant',
                content: assistantContent
              });

              // Add tool results
              const toolResults = assistantContent
                .filter(c => c.type === 'tool_use')
                .map(toolUse => {
                  const entry = toolResultsMap.get(toolUse.id);
                  const sanitized = entry?.sanitized ?? entry ?? {};
                  const payload = {
                    tool_name: entry?.meta?.tool_name ?? toolUse.name,
                    result: sanitized,
                  };
                  return {
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(payload)
                  };
                });

              if (toolResults.length > 0) {
                conversationMessages.push({
                  role: 'user',
                  content: toolResults
                });
                // Continue the loop to get Claude's response
              } else {
                shouldContinue = false;
              }
            } else {
              shouldContinue = false;
            }
          }

          // Send done signal
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


