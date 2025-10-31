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
];

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

IMPORTANT:
- Only provide what the user asks for. Do not add extra visualizations, tables, or analysis unless explicitly requested.
- DO NOT create text-based charts or ASCII art - write actual executable code
- The code block MUST use the \`\`\`chartcode language tag for proper detection
- CRITICAL: You MUST use React.createElement() syntax, NOT JSX syntax (no <Component /> tags)
- JSX will NOT work in the execution environment - only React.createElement works

WHEN TO USE EACH TOOL:
✅ get_persistency_analytics: "How many active policies?", "Show policies by carrier", "What's our lapse rate?"
❌ get_deals: "Show me the client names for Aflac policies", "What premium did client John Doe pay?"

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

                  // Store tool result
                  toolResultsMap.set(currentToolUse.id, toolResult);

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
                  const result = toolResultsMap.get(toolUse.id);
                  return {
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result || {})
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


