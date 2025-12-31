import { createServerClient } from '@/lib/supabase/server';
import { UserContext } from '@/lib/ai-permissions';
import { generateVisualization, VisualizationInput } from '@/lib/ai-visualization-tool';

// Levenshtein distance for client-side fuzzy matching (small datasets like carriers)
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Calculate similarity score (0.0 to 1.0) based on Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Format fuzzy search suggestions for response
function formatSuggestionMessage(query: string, suggestions: Array<{ name: string }>): string {
  if (suggestions.length === 0) return '';
  const names = suggestions.slice(0, 3).map(s => s.name).join(', ');
  return `No exact match for "${query}". Did you mean: ${names}?`;
}

// Static carrier resources data (from resources page)
const CARRIER_RESOURCES: Record<string, {
  name: string;
  phone?: string;
  fax?: string;
  email?: string;
  support_hours?: string;
  website_url?: string;
  portal_url?: string;
  address?: string;
  notes?: string[];
}> = {
  'american-amicable': {
    name: 'American Amicable Group',
    phone: '(800) 736-7311',
    fax: '(254) 297-2100',
    support_hours: 'Mon-Fri | 8am-4pm CT',
    website_url: 'https://www.americanamicable.com',
    portal_url: 'https://www.americanamicable.com/agent-portal',
    notes: ['Not available in NY']
  },
  'american-home-life': {
    name: 'American Home Life Insurance Company',
    phone: '(800) 756-1245',
    support_hours: 'Mon-Fri | 8am-5pm CT',
    portal_url: 'https://www.amhomelife.com/ahlcas/login',
  },
  'americo': {
    name: 'Americo',
    phone: '(800) 231-0801',
    support_hours: 'Mon-Fri | 7am-6pm CT',
    website_url: 'https://www.americo.com',
    portal_url: 'https://agent.americo.com',
  },
  'foresters': {
    name: 'Foresters Financial',
    phone: '(800) 828-1540',
    support_hours: 'Mon-Fri | 8am-8pm ET',
    website_url: 'https://www.foresters.com',
    portal_url: 'https://www.foresters.com/en-us/agents',
  },
  'legal-general': {
    name: 'Legal & General',
    phone: '(800) 555-5555',
    website_url: 'https://www.lgamerica.com',
    portal_url: 'https://www.lgamerica.com/agents',
  },
  'mutual-omaha': {
    name: 'Mutual of Omaha',
    phone: '(800) 775-6000',
    support_hours: 'Mon-Fri | 7am-6pm CT',
    website_url: 'https://www.mutualofomaha.com',
    portal_url: 'https://producer.mutualofomaha.com',
  },
  'national-life': {
    name: 'National Life Group',
    phone: '(800) 732-8939',
    support_hours: 'Mon-Fri | 8am-6pm ET',
    website_url: 'https://www.nationallife.com',
    portal_url: 'https://www.nationallife.com/producers',
  },
  'sbli': {
    name: 'SBLI',
    phone: '(888) 438-7254',
    support_hours: 'Mon-Fri | 8am-5pm ET',
    website_url: 'https://www.sbli.com',
    portal_url: 'https://www.sbli.com/agents',
  },
  'transamerica': {
    name: 'Transamerica',
    phone: '(800) 851-7555',
    support_hours: 'Mon-Fri | 8am-6pm CT',
    website_url: 'https://www.transamerica.com',
    portal_url: 'https://www.transamerica.com/agents',
  },
  'united-home-life': {
    name: 'United Home Life Insurance Company',
    phone: '(800) 234-2040',
    support_hours: 'Mon-Fri | 8am-4:30pm ET',
    website_url: 'https://www.unitedhomelife.com',
    portal_url: 'https://www.unitedhomelife.com/agent-login',
  },
  'corebridge': {
    name: 'Corebridge Financial',
    phone: '(800) 448-2542',
    website_url: 'https://www.corebridgefinancial.com',
    portal_url: 'https://www.corebridgefinancial.com/producers',
  },
  'ethos': {
    name: 'Ethos',
    phone: '(415) 322-8642',
    website_url: 'https://www.ethoslife.com',
    portal_url: 'https://agents.ethoslife.com',
  },
  'fg-annuities': {
    name: 'F&G Annuities & Life',
    phone: '(888) 513-8797',
    website_url: 'https://www.fglife.com',
    portal_url: 'https://www.fglife.com/agents',
  },
  'liberty-bankers': {
    name: 'Liberty Bankers Life',
    phone: '(800) 543-0443',
    support_hours: 'Mon-Fri | 8am-5pm CT',
    website_url: 'https://www.libertybankers.com',
    portal_url: 'https://www.libertybankers.com/agent-portal',
  },
};

// Get deals/policies data
export async function getDeals(params: any, agencyId: string, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();

    let query = supabase
      .from('deals')
      .select(`
        *,
        agent:users!deals_agent_id_fkey(id, first_name, last_name, email),
        carrier:carriers(id, name, display_name),
        product:products(id, name, product_code)
      `)
      .eq('agency_id', agencyId);

    // PERMISSION FILTER: Only show deals for allowed agents
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('agent_id', allowedAgentIds);
    }

    // Apply filters
    if (params.status && params.status !== 'all') {
      query = query.eq('status_standardized', params.status);
    }

    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }

    if (params.carrier_id) {
      query = query.eq('carrier_id', params.carrier_id);
    }

    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }

    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    query = query.limit(params.limit || 100);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching deals:', error);
      throw new Error('Failed to fetch deals');
    }

    // Calculate aggregates
    const totalPremium = data?.reduce((sum, deal) => sum + (Number(deal.annual_premium) || 0), 0) || 0;
    const avgPremium = data && data.length > 0 ? totalPremium / data.length : 0;
    const statusCounts = data?.reduce((acc: any, deal) => {
      const status = deal.status_standardized || deal.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Limit data to prevent token overflow - only return first 20 deals for context
    return {
      deals: data?.slice(0, 20) || [],
      count: data?.length || 0,
      summary: {
        total_annual_premium: totalPremium,
        average_premium: avgPremium,
        status_breakdown: statusCounts
      },
      note: data && data.length > 20 ? `Showing 20 of ${data.length} deals. Summary statistics include all deals.` : undefined
    };
  } catch (error) {
    console.error('Get deals error:', error);
    return { error: 'Failed to get deals' };
  }
}

// Get agents data
export async function getAgents(params: any, agencyId: string, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();

    let query = supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        total_prod,
        total_policies_sold,
        annual_goal,
        start_date,
        status,
        is_active,
        upline_id
      `)
      .eq('agency_id', agencyId)
      .neq('role', 'client');

    // PERMISSION FILTER: Only show allowed agents
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('id', allowedAgentIds);
    }

    if (params.agent_id) {
      query = query.eq('id', params.agent_id);
    }

    if (params.top_performers) {
      query = query
        .order('total_prod', { ascending: false })
        .limit(params.limit || 10);
    } else {
      query = query
        .order('total_prod', { ascending: false })
        .limit(params.limit || 100);
    }

    const { data: agents, error } = await query;

    if (error) {
      console.error('Error fetching agents:', error);
      throw new Error('Failed to fetch agents');
    }

    // Get downlines if requested
    let agentsWithDownlines = agents;
    if (params.include_downlines && params.agent_id) {
      const { data: downlines } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, total_prod, total_policies_sold')
        .eq('upline_id', params.agent_id)
        .eq('agency_id', agencyId);

      agentsWithDownlines = agents?.map(agent => ({
        ...agent,
        downlines: agent.id === params.agent_id ? downlines : []
      }));
    }

    // Calculate summary
    const totalProduction = agents?.reduce((sum, agent) => sum + (Number(agent.total_prod) || 0), 0) || 0;
    const totalPolicies = agents?.reduce((sum, agent) => sum + (Number(agent.total_policies_sold) || 0), 0) || 0;
    const avgProduction = agents && agents.length > 0 ? totalProduction / agents.length : 0;

    // Limit data to prevent token overflow - only return top 25 agents for context
    const limitedAgents = agentsWithDownlines?.slice(0, 25) || [];

    return {
      agents: limitedAgents,
      count: agents?.length || 0,
      summary: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        average_production: avgProduction,
        active_agents: agents?.filter(a => a.is_active).length || 0
      },
      note: agents && agents.length > 25 ? `Showing top 25 of ${agents.length} agents. Summary statistics include all agents.` : undefined
    };
  } catch (error) {
    console.error('Get agents error:', error);
    return { error: 'Failed to get agents' };
  }
}

// Get conversations data
export async function getConversationsData(params: any, agencyId: string, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();

    const dateRangeDays = params.date_range_days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRangeDays);

    let conversationsQuery = supabase
      .from('conversations')
      .select(`
        id,
        type,
        last_message_at,
        is_active,
        client_phone,
        sms_opt_in_status,
        agent:users!conversations_agent_id_fkey(id, first_name, last_name),
        deal:deals!conversations_deal_id_fkey(id, client_name, policy_number)
      `)
      .eq('agency_id', agencyId)
      .gte('last_message_at', startDate.toISOString());

    // PERMISSION FILTER: Only show conversations for allowed agents
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      conversationsQuery = conversationsQuery.in('agent_id', allowedAgentIds);
    }

    if (params.agent_id) {
      conversationsQuery = conversationsQuery.eq('agent_id', params.agent_id);
    }

    const { data: conversations, error: convError } = await conversationsQuery;

    if (convError) {
      console.error('Error fetching conversations:', convError);
      throw new Error('Failed to fetch conversations');
    }

    // Get message counts
    let messagesData = null;
    if (params.include_messages && conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id);

      const { data: messages } = await supabase
        .from('messages')
        .select('id, conversation_id, direction, sent_at, body')
        .in('conversation_id', conversationIds)
        .gte('sent_at', startDate.toISOString())
        .order('sent_at', { ascending: false })
        .limit(100);

      messagesData = messages;
    }

    // Calculate summary
    const totalConversations = conversations?.length || 0;
    const activeConversations = conversations?.filter(c => c.is_active).length || 0;
    const optedInCount = conversations?.filter(c => c.sms_opt_in_status === 'opted_in').length || 0;

    // Limit data to prevent token overflow
    const limitedConversations = conversations?.slice(0, 15) || [];

    return {
      conversations: limitedConversations,
      messages: messagesData,
      summary: {
        total_conversations: totalConversations,
        active_conversations: activeConversations,
        opted_in_clients: optedInCount,
        date_range_days: dateRangeDays
      },
      note: conversations && conversations.length > 15 ? `Showing 15 of ${conversations.length} conversations.` : undefined
    };
  } catch (error) {
    console.error('Get conversations error:', error);
    return { error: 'Failed to get conversations data' };
  }
}

// Get carriers and products
export async function getCarriersAndProducts(params: any, agencyId: string) {
  try {
    const supabase = await createServerClient();

    // Get carriers
    let carriersQuery = supabase
      .from('carriers')
      .select('id, name, display_name, is_active');

    if (params.carrier_id) {
      carriersQuery = carriersQuery.eq('id', params.carrier_id);
    }

    if (params.active_only !== false) {
      carriersQuery = carriersQuery.eq('is_active', true);
    }

    const { data: carriers, error: carriersError } = await carriersQuery;

    if (carriersError) {
      console.error('Error fetching carriers:', carriersError);
      throw new Error('Failed to fetch carriers');
    }

    // Get products for the agency
    let productsQuery = supabase
      .from('products')
      .select(`
        id,
        name,
        product_code,
        is_active,
        carrier:carriers(id, name, display_name)
      `)
      .or(`agency_id.eq.${agencyId},agency_id.is.null`);

    if (params.carrier_id) {
      productsQuery = productsQuery.eq('carrier_id', params.carrier_id);
    }

    if (params.active_only !== false) {
      productsQuery = productsQuery.eq('is_active', true);
    }

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw new Error('Failed to fetch products');
    }

    // Group products by carrier
    const productsByCarrier = products?.reduce((acc: any, product: any) => {
      const carrierId = product.carrier?.id;
      if (!acc[carrierId]) {
        acc[carrierId] = [];
      }
      acc[carrierId].push(product);
      return acc;
    }, {}) || {};

    return {
      carriers: carriers,
      products: products,
      products_by_carrier: productsByCarrier,
      summary: {
        total_carriers: carriers?.length || 0,
        total_products: products?.length || 0
      }
    };
  } catch (error) {
    console.error('Get carriers and products error:', error);
    return { error: 'Failed to get carriers and products' };
  }
}

// Get agency summary
export async function getAgencySummary(params: any, agencyId: string) {
  try {
    const supabase = await createServerClient();

    // Get date range based on time period
    let startDate: Date | null = null;
    const now = new Date();

    switch (params.time_period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = null;
    }

    // Get agency info
    const { data: agency } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single();

    // Get agent count
    const { count: agentCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .neq('role', 'client')
      .eq('is_active', true);

    // Get deals with date filter if applicable
    let dealsQuery = supabase
      .from('deals')
      .select('annual_premium, status_standardized, created_at')
      .eq('agency_id', agencyId);

    if (startDate) {
      dealsQuery = dealsQuery.gte('created_at', startDate.toISOString());
    }

    const { data: deals } = await dealsQuery;

    // Calculate metrics
    const totalProduction = deals?.reduce((sum, deal) => sum + (Number(deal.annual_premium) || 0), 0) || 0;
    const totalPolicies = deals?.length || 0;
    const activePolicies = deals?.filter(d => d.status_standardized === 'active').length || 0;

    // Get top agents
    const { data: topAgents } = await supabase
      .from('users')
      .select('id, first_name, last_name, total_prod, total_policies_sold')
      .eq('agency_id', agencyId)
      .neq('role', 'client')
      .eq('is_active', true)
      .order('total_prod', { ascending: false })
      .limit(5);

    // Get recent activity (limit to 5 to reduce token usage)
    const { data: recentDeals } = await supabase
      .from('deals')
      .select(`
        id,
        client_name,
        annual_premium,
        created_at,
        status_standardized,
        agent:users!deals_agent_id_fkey(first_name, last_name)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      agency: {
        name: agency?.name,
        display_name: agency?.display_name,
        code: agency?.code,
        is_active: agency?.is_active
      },
      metrics: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        active_policies: activePolicies,
        agent_count: agentCount || 0,
        time_period: params.time_period || 'all'
      },
      top_agents: topAgents,
      recent_activity: recentDeals,
      note: 'Recent activity limited to 5 most recent deals'
    };
  } catch (error) {
    console.error('Get agency summary error:', error);
    return { error: 'Failed to get agency summary' };
  }
}

// Get comprehensive analytics using the same RPC as the analytics dashboard page
export async function getPersistencyAnalytics(params: any, agencyId: string, userContext?: UserContext) {
  try {
    const supabase = await createServerClient();

    // For non-admin users, we need to filter analytics to their scope
    // The RPC function doesn't support agent filtering, so we need to use a different approach
    // For now, we'll use the full agency data for admins, and note the limitation for non-admins
    const isAdmin = !userContext || userContext.is_admin;

    // Call the SAME RPC function that the analytics dashboard page uses
    // This provides comprehensive analytics data including:
    // - Time series by month and carrier
    // - Breakdowns by status, state, age band
    // - Multiple time windows (3m, 6m, 9m, all_time)
    // - Persistency, submitted, and active policy counts
    const { data, error } = await supabase.rpc('get_analytics_from_deals_with_agency_id', {
      p_agency_id: agencyId
    });

    // Note: For non-admin users, we're showing agency-wide analytics
    // In a future enhancement, the RPC should support agent filtering
    const scopeNote = !isAdmin
      ? 'Note: Analytics show your team\'s contribution to agency metrics. For detailed personal analytics, use get_deals or get_agents with your specific filters.'
      : undefined;

    if (error) {
      console.error('Error fetching analytics:', error);
      throw new Error('Failed to fetch analytics data');
    }

    if (!data || !data.meta || !data.series || data.series.length === 0) {
      return {
        message: 'No analytics data available. Please upload policy reports first.',
        meta: null,
        series: [],
        totals: null,
        windows_by_carrier: null,
        breakdowns_over_time: null,
        scope_note: scopeNote
      };
    }

    // Return the full analytics object with all breakdowns
    // This matches the structure used by the analytics dashboard
    return {
      ...data,
      scope_note: scopeNote
    };
  } catch (error) {
    console.error('Error in getPersistencyAnalytics:', error);
    return { error: 'Failed to get analytics data' };
  }
}

// Fuzzy search for agents
export async function searchAgents(params: any, agencyId: string, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();
    const query = params.query || '';
    const limit = params.limit || 20;

    if (!query || query.trim().length < 2) {
      return { error: 'Search query must be at least 2 characters long' };
    }

    // Use fuzzy RPC function for similarity-based search
    const { data, error } = await supabase.rpc('search_agents_fuzzy', {
      p_query: query.trim(),
      p_agency_id: agencyId,
      p_allowed_agent_ids: allowedAgentIds?.length ? allowedAgentIds : null,
      p_limit: limit,
      p_similarity_threshold: 0.3
    });

    if (error) {
      console.error('Fuzzy search error:', error);
      // Fallback to basic ILIKE search if RPC fails
      return await searchAgentsFallback(params, agencyId, allowedAgentIds);
    }

    // Categorize results
    const exactMatches = data?.filter((r: any) => r.match_type === 'exact' || r.match_type === 'fuzzy') || [];
    const suggestions = data?.filter((r: any) => r.match_type === 'suggestion') || [];

    // Format results
    const agents = exactMatches.map((a: any) => ({
      id: a.id,
      name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
      first_name: a.first_name,
      last_name: a.last_name,
      email: a.email,
      total_production: a.total_prod || 0,
      similarity_score: a.similarity_score
    }));

    // Build response with suggestions if no direct matches
    const response: any = {
      agents,
      count: agents.length,
      query: query.trim()
    };

    if (agents.length === 0 && suggestions.length > 0) {
      response.no_exact_match = true;
      response.suggestions = suggestions.slice(0, 5).map((s: any) => ({
        id: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        email: s.email,
        similarity_score: s.similarity_score
      }));
      response.suggestion_message = formatSuggestionMessage(
        query.trim(),
        suggestions.slice(0, 3).map((s: any) => ({
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim()
        }))
      );
    }

    return response;
  } catch (error) {
    console.error('Search agents error:', error);
    return { error: 'Failed to search agents' };
  }
}

// Fallback to basic ILIKE search if RPC fails
async function searchAgentsFallback(params: any, agencyId: string, allowedAgentIds?: string[]) {
  const supabase = await createServerClient();
  const query = params.query || '';
  const limit = params.limit || 20;
  const sanitizedQuery = query.trim().replace(/[%_]/g, '\\$&');

  const orConditions = [
    `first_name.ilike.%${sanitizedQuery}%`,
    `last_name.ilike.%${sanitizedQuery}%`,
    `email.ilike.%${sanitizedQuery}%`
  ];

  let searchQuery = supabase
    .from('users')
    .select('id, first_name, last_name, email, total_prod')
    .eq('agency_id', agencyId)
    .neq('role', 'client')
    .or(orConditions.join(','))
    .limit(limit);

  if (allowedAgentIds && allowedAgentIds.length > 0) {
    searchQuery = searchQuery.in('id', allowedAgentIds);
  }

  const { data: agents, error } = await searchQuery;

  if (error) {
    return { error: 'Failed to search agents' };
  }

  return {
    agents: (agents || []).map((a: any) => ({
      id: a.id,
      name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
      email: a.email,
      total_production: a.total_prod || 0
    })),
    count: agents?.length || 0,
    query: query.trim()
  };
}

// Fuzzy search for clients
export async function searchClients(params: any, agencyId: string, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();
    const query = params.query || '';
    const limit = params.limit || 20;

    if (!query || query.trim().length < 2) {
      return { error: 'Search query must be at least 2 characters long' };
    }

    // Use fuzzy RPC function for similarity-based search
    const { data, error } = await supabase.rpc('search_clients_fuzzy', {
      p_query: query.trim(),
      p_agency_id: agencyId,
      p_allowed_agent_ids: allowedAgentIds?.length ? allowedAgentIds : null,
      p_limit: limit,
      p_similarity_threshold: 0.3
    });

    if (error) {
      console.error('Fuzzy search error:', error);
      // Fallback to basic ILIKE search if RPC fails
      return await searchClientsFallback(params, agencyId, allowedAgentIds);
    }

    // Categorize results
    const exactMatches = data?.filter((r: any) => r.match_type === 'exact' || r.match_type === 'fuzzy') || [];
    const suggestions = data?.filter((r: any) => r.match_type === 'suggestion') || [];

    // Format results
    const clients = exactMatches.map((c: any) => ({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone_number: c.phone_number,
      similarity_score: c.similarity_score
    }));

    // Build response with suggestions if no direct matches
    const response: any = {
      clients,
      count: clients.length,
      query: query.trim()
    };

    if (clients.length === 0 && suggestions.length > 0) {
      response.no_exact_match = true;
      response.suggestions = suggestions.slice(0, 5).map((s: any) => ({
        id: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        email: s.email,
        similarity_score: s.similarity_score
      }));
      response.suggestion_message = formatSuggestionMessage(
        query.trim(),
        suggestions.slice(0, 3).map((s: any) => ({
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim()
        }))
      );
    }

    return response;
  } catch (error) {
    console.error('Search clients error:', error);
    return { error: 'Failed to search clients' };
  }
}

// Fallback to basic ILIKE search if RPC fails
async function searchClientsFallback(params: any, agencyId: string, allowedAgentIds?: string[]) {
  const supabase = await createServerClient();
  const query = params.query || '';
  const limit = params.limit || 20;
  const sanitizedQuery = query.trim().replace(/[%_]/g, '\\$&');

  const orConditions = [
    `first_name.ilike.%${sanitizedQuery}%`,
    `last_name.ilike.%${sanitizedQuery}%`,
    `email.ilike.%${sanitizedQuery}%`,
    `phone_number.ilike.%${sanitizedQuery}%`
  ];

  let searchQuery = supabase
    .from('clients')
    .select('id, first_name, last_name, email, phone_number')
    .eq('agency_id', agencyId)
    .or(orConditions.join(','))
    .limit(limit);

  if (allowedAgentIds && allowedAgentIds.length > 0) {
    searchQuery = searchQuery.in('supporting_agent_id', allowedAgentIds);
  }

  const { data: clients, error } = await searchQuery;

  if (error) {
    return { error: 'Failed to search clients' };
  }

  return {
    clients: (clients || []).map((c: any) => ({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      email: c.email,
      phone_number: c.phone_number
    })),
    count: clients?.length || 0,
    query: query.trim()
  };
}

// Fuzzy search for policies/deals
export async function searchPolicies(params: any, agencyId: string, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();
    const query = params.query || '';
    const limit = params.limit || 20;

    if (!query || query.trim().length < 2) {
      return { error: 'Search query must be at least 2 characters long' };
    }

    // Use fuzzy RPC function for similarity-based search
    const { data, error } = await supabase.rpc('search_policies_fuzzy', {
      p_query: query.trim(),
      p_agency_id: agencyId,
      p_allowed_agent_ids: allowedAgentIds?.length ? allowedAgentIds : null,
      p_limit: limit,
      p_similarity_threshold: 0.3
    });

    if (error) {
      console.error('Fuzzy search error:', error);
      // Fallback to basic ILIKE search if RPC fails
      return await searchPoliciesFallback(params, agencyId, allowedAgentIds);
    }

    // Categorize results
    const exactMatches = data?.filter((r: any) => r.match_type === 'exact' || r.match_type === 'fuzzy') || [];
    const suggestions = data?.filter((r: any) => r.match_type === 'suggestion') || [];

    // Format results - need to fetch full details for matched policies
    const policyIds = exactMatches.map((p: any) => p.id);
    let policies: any[] = [];

    if (policyIds.length > 0) {
      const { data: fullPolicies, error: detailsError } = await supabase
        .from('deals')
        .select(`
          id,
          policy_number,
          application_number,
          client_name,
          client_phone,
          annual_premium,
          status,
          agent:users!deals_agent_id_fkey(id, first_name, last_name),
          carrier:carriers(id, display_name),
          product:products(id, name)
        `)
        .in('id', policyIds);

      if (!detailsError && fullPolicies) {
        policies = fullPolicies.map((p: any) => ({
          ...p,
          similarity_score: exactMatches.find((m: any) => m.id === p.id)?.similarity_score
        }));
      }
    }

    // Build response with suggestions if no direct matches
    const response: any = {
      policies,
      count: policies.length,
      query: query.trim()
    };

    if (policies.length === 0 && suggestions.length > 0) {
      response.no_exact_match = true;
      response.suggestions = suggestions.slice(0, 5).map((s: any) => ({
        id: s.id,
        policy_number: s.policy_number,
        application_number: s.application_number,
        client_name: s.client_name,
        similarity_score: s.similarity_score
      }));
      response.suggestion_message = formatSuggestionMessage(
        query.trim(),
        suggestions.slice(0, 3).map((s: any) => ({
          name: s.client_name || s.policy_number || s.application_number
        }))
      );
    }

    return response;
  } catch (error) {
    console.error('Search policies error:', error);
    return { error: 'Failed to search policies' };
  }
}

// Fallback to basic ILIKE search if RPC fails
async function searchPoliciesFallback(params: any, agencyId: string, allowedAgentIds?: string[]) {
  const supabase = await createServerClient();
  const query = params.query || '';
  const limit = params.limit || 20;
  const sanitizedQuery = query.trim().replace(/[%_]/g, '\\$&');

  let searchQuery = supabase
    .from('deals')
    .select(`
      id,
      policy_number,
      application_number,
      client_name,
      client_phone,
      annual_premium,
      status,
      agent:users!deals_agent_id_fkey(id, first_name, last_name),
      carrier:carriers(id, display_name),
      product:products(id, name)
    `)
    .eq('agency_id', agencyId)
    .or(`policy_number.ilike.%${sanitizedQuery}%,application_number.ilike.%${sanitizedQuery}%,client_name.ilike.%${sanitizedQuery}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  // PERMISSION FILTER: Only search policies for allowed agents
  if (allowedAgentIds && allowedAgentIds.length > 0) {
    searchQuery = searchQuery.in('agent_id', allowedAgentIds);
  }

  const { data: deals, error } = await searchQuery;

  if (error) {
    console.error('Error searching policies:', error);
    return { error: 'Failed to search policies' };
  }

  return {
    policies: deals || [],
    count: deals?.length || 0,
    query: query.trim()
  };
}

// Get agent hierarchy with production metrics
export async function getAgentHierarchy(params: any, agencyId: string) {
  try {
    const supabase = await createServerClient();
    const agentId = params.agent_id;

    if (!agentId) {
      return { error: 'Agent ID is required' };
    }

    // Get the root agent
    const { data: rootAgent, error: rootError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, total_prod, total_policies_sold, upline_id, status')
      .eq('id', agentId)
      .eq('agency_id', agencyId)
      .single();

    if (rootError || !rootAgent) {
      return { error: 'Agent not found' };
    }

    // Get complete downline using RPC function
    const { data: downline, error: downlineError } = await supabase.rpc('get_agent_downline', {
      agent_id: agentId
    });

    if (downlineError) {
      console.error('Error fetching downline:', downlineError);
      return { error: 'Failed to fetch agent hierarchy' };
    }

    // Get detailed info for all agents in hierarchy
    const allAgentIds = [agentId, ...((downline as any[])?.map((u: any) => u.id) || [])];

    const { data: allAgents, error: agentsError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, total_prod, total_policies_sold, upline_id, status')
      .in('id', allAgentIds)
      .eq('agency_id', agencyId);

    if (agentsError) {
      console.error('Error fetching agent details:', agentsError);
      return { error: 'Failed to fetch agent details' };
    }

    // Calculate aggregate metrics
    const totalProduction = allAgents?.reduce((sum, agent) => sum + (Number(agent.total_prod) || 0), 0) || 0;
    const totalPolicies = allAgents?.reduce((sum, agent) => sum + (Number(agent.total_policies_sold) || 0), 0) || 0;
    const activeAgents = allAgents?.filter(a => a.status === 'active').length || 0;

    // Build hierarchy structure
    const agentsById = new Map(allAgents?.map(a => [a.id, a]) || []);
    const childrenMap = new Map<string, any[]>();

    allAgents?.forEach(agent => {
      if (agent.upline_id && agentsById.has(agent.upline_id)) {
        if (!childrenMap.has(agent.upline_id)) {
          childrenMap.set(agent.upline_id, []);
        }
        childrenMap.get(agent.upline_id)!.push(agent);
      }
    });

    return {
      root_agent: rootAgent,
      hierarchy: {
        total_agents: allAgents?.length || 0,
        total_production: totalProduction,
        total_policies: totalPolicies,
        active_agents: activeAgents,
        average_production: allAgents && allAgents.length > 0 ? totalProduction / allAgents.length : 0
      },
      agents: allAgents,
      note: 'Use compare_hierarchies tool to compare multiple hierarchies'
    };
  } catch (error) {
    console.error('Get agent hierarchy error:', error);
    return { error: 'Failed to get agent hierarchy' };
  }
}

// Compare multiple agent hierarchies
export async function compareHierarchies(params: any, agencyId: string) {
  try {
    const supabase = await createServerClient();
    const agentIds = params.agent_ids || [];

    if (!agentIds || agentIds.length === 0) {
      return { error: 'At least one agent ID is required' };
    }

    const comparisons = await Promise.all(
      agentIds.map(async (agentId: string) => {
        const hierarchy = await getAgentHierarchy({ agent_id: agentId }, agencyId);
        if (hierarchy.error) {
          return { agent_id: agentId, error: hierarchy.error };
        }

        return {
          agent_id: agentId,
          root_agent: hierarchy.root_agent,
          metrics: hierarchy.hierarchy
        };
      })
    );

    // Calculate comparison metrics
    const totalProduction = comparisons.reduce((sum, comp) =>
      sum + (comp.metrics?.total_production || 0), 0);
    const totalPolicies = comparisons.reduce((sum, comp) =>
      sum + (comp.metrics?.total_policies || 0), 0);
    const totalAgents = comparisons.reduce((sum, comp) =>
      sum + (comp.metrics?.total_agents || 0), 0);

    // Find best performing hierarchy
    const bestProduction = comparisons.reduce((best, comp) =>
      (comp.metrics?.total_production || 0) > (best.metrics?.total_production || 0) ? comp : best,
      comparisons[0] || { metrics: { total_production: 0 } });

    return {
      comparisons: comparisons,
      summary: {
        total_hierarchies: comparisons.length,
        total_production: totalProduction,
        total_policies: totalPolicies,
        total_agents: totalAgents,
        average_production_per_hierarchy: comparisons.length > 0 ? totalProduction / comparisons.length : 0
      },
      best_performing: bestProduction,
      note: 'Compare hierarchies by total_production, total_policies, or total_agents'
    };
  } catch (error) {
    console.error('Compare hierarchies error:', error);
    return { error: 'Failed to compare hierarchies' };
  }
}

// Get deals with cursor pagination
export async function getDealsPaginated(params: any, agencyId: string, cursor?: { cursor_created_at: string; cursor_id: string }, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();
    const limit = Math.min(params.limit || 50, 200);

    let query = supabase
      .from('deals')
      .select(`
        id,
        created_at,
        policy_number,
        application_number,
        client_name,
        client_phone,
        policy_effective_date,
        annual_premium,
        lead_source,
        billing_cycle,
        status,
        status_standardized,
        agent:users!deals_agent_id_fkey(id, first_name, last_name, email),
        carrier:carriers(id, name, display_name),
        product:products(id, name, product_code)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    // PERMISSION FILTER: Only show deals for allowed agents
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('agent_id', allowedAgentIds);
    }

    // Apply filters
    if (params.status && params.status !== 'all') {
      query = query.eq('status_standardized', params.status);
    }
    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }
    if (params.carrier_id) {
      query = query.eq('carrier_id', params.carrier_id);
    }
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    // Apply cursor pagination
    if (cursor?.cursor_created_at && cursor?.cursor_id) {
      const iso = new Date(cursor.cursor_created_at).toISOString();
      query = query.or(`created_at.lt.${iso},and(created_at.eq.${iso},id.lt.${cursor.cursor_id})`);
    }

    const { data: deals, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching paginated deals:', error);
      throw new Error('Failed to fetch deals');
    }

    // Calculate aggregates for this page
    const totalPremium = deals?.reduce((sum, deal) => sum + (Number(deal.annual_premium) || 0), 0) || 0;
    const statusCounts = deals?.reduce((acc: any, deal) => {
      const status = deal.status_standardized || deal.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Provide next cursor
    const last = deals && deals.length > 0 ? deals[deals.length - 1] : null;
    const nextCursor = last ? { cursor_created_at: last.created_at, cursor_id: last.id } : null;

    return {
      deals: deals || [],
      count: deals?.length || 0,
      has_more: nextCursor !== null,
      next_cursor: nextCursor,
      page_summary: {
        total_premium: totalPremium,
        status_breakdown: statusCounts
      }
    };
  } catch (error) {
    console.error('Get deals paginated error:', error);
    return { error: 'Failed to get paginated deals' };
  }
}

// Get agents with cursor pagination
export async function getAgentsPaginated(params: any, agencyId: string, cursor?: { cursor_id: string }, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();
    const limit = Math.min(params.limit || 50, 200);

    let query = supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        total_prod,
        total_policies_sold,
        annual_goal,
        start_date,
        status,
        is_active,
        upline_id
      `)
      .eq('agency_id', agencyId)
      .neq('role', 'client')
      .order('total_prod', { ascending: false })
      .order('id', { ascending: false });

    // PERMISSION FILTER: Only show allowed agents
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('id', allowedAgentIds);
    }

    // Apply filters
    if (params.agent_id) {
      query = query.eq('id', params.agent_id);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.top_performers) {
      // For top performers, we don't need cursor
    }

    // Apply cursor pagination
    if (cursor?.cursor_id) {
      query = query.lt('id', cursor.cursor_id);
    }

    const { data: agents, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching paginated agents:', error);
      throw new Error('Failed to fetch agents');
    }

    // Calculate aggregates for this page
    const totalProduction = agents?.reduce((sum, agent) => sum + (Number(agent.total_prod) || 0), 0) || 0;
    const totalPolicies = agents?.reduce((sum, agent) => sum + (Number(agent.total_policies_sold) || 0), 0) || 0;
    const activeAgents = agents?.filter(a => a.is_active).length || 0;

    // Provide next cursor
    const last = agents && agents.length > 0 ? agents[agents.length - 1] : null;
    const nextCursor = last ? { cursor_id: last.id } : null;

    return {
      agents: agents || [],
      count: agents?.length || 0,
      has_more: nextCursor !== null,
      next_cursor: nextCursor,
      page_summary: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        active_agents: activeAgents,
        average_production: agents && agents.length > 0 ? totalProduction / agents.length : 0
      }
    };
  } catch (error) {
    console.error('Get agents paginated error:', error);
    return { error: 'Failed to get paginated agents' };
  }
}

// Smart data summarization based on query intent
export async function getDataSummary(params: any, agencyId: string, allowedAgentIds?: string[]) {
  try {
    const supabase = await createServerClient();
    const dataType = params.data_type || 'deals'; // 'deals', 'agents', 'clients'
    const summaryType = params.summary_type || 'counts'; // 'counts', 'aggregates', 'breakdown'

    if (dataType === 'deals') {
      let query = supabase
        .from('deals')
        .select('annual_premium, status_standardized, created_at, agent_id, carrier_id')
        .eq('agency_id', agencyId);

      // PERMISSION FILTER: Only summarize deals for allowed agents
      if (allowedAgentIds && allowedAgentIds.length > 0) {
        query = query.in('agent_id', allowedAgentIds);
      }

      // Apply filters
      if (params.status && params.status !== 'all') {
        query = query.eq('status_standardized', params.status);
      }
      if (params.agent_id) {
        query = query.eq('agent_id', params.agent_id);
      }
      if (params.carrier_id) {
        query = query.eq('carrier_id', params.carrier_id);
      }
      if (params.start_date) {
        query = query.gte('created_at', params.start_date);
      }
      if (params.end_date) {
        query = query.lte('created_at', params.end_date);
      }

      // Get count first to check if we need pagination
      let countQuery = supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId);

      // PERMISSION FILTER: Apply to count query too
      if (allowedAgentIds && allowedAgentIds.length > 0) {
        countQuery = countQuery.in('agent_id', allowedAgentIds);
      }

      // Apply same filters to count query
      if (params.status && params.status !== 'all') {
        countQuery = countQuery.eq('status_standardized', params.status);
      }
      if (params.agent_id) {
        countQuery = countQuery.eq('agent_id', params.agent_id);
      }
      if (params.carrier_id) {
        countQuery = countQuery.eq('carrier_id', params.carrier_id);
      }
      if (params.start_date) {
        countQuery = countQuery.gte('created_at', params.start_date);
      }
      if (params.end_date) {
        countQuery = countQuery.lte('created_at', params.end_date);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        throw new Error('Failed to get deal count');
      }

      const totalCount = count || 0;

      // If count is large, return summary only
      if (totalCount > 1000) {
        // Get sample for calculations (first 1000)
        const { data: sampleDeals } = await query.limit(1000);

        const totalPremium = sampleDeals?.reduce((sum, deal) => sum + (Number(deal.annual_premium) || 0), 0) || 0;
        const statusCounts = sampleDeals?.reduce((acc: any, deal) => {
          const status = deal.status_standardized || deal.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}) || {};

        return {
          data_type: 'deals',
          total_count: totalCount,
          summary_only: true,
          note: `Dataset exceeds 1000 entries. Showing summary based on sample. Use get_deals_paginated for detailed data.`,
          summary: {
            estimated_total_premium: totalPremium * (totalCount / Math.min(totalCount, 1000)),
            status_breakdown: statusCounts,
            sample_size: Math.min(totalCount, 1000)
          }
        };
      }

      // Get full data for smaller datasets
      const { data: deals } = await query;
      const totalPremium = deals?.reduce((sum, deal) => sum + (Number(deal.annual_premium) || 0), 0) || 0;
      const statusCounts = deals?.reduce((acc: any, deal) => {
        const status = deal.status_standardized || deal.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}) || {};

      return {
        data_type: 'deals',
        total_count: totalCount,
        summary_only: false,
        summary: {
          total_premium: totalPremium,
          average_premium: totalCount > 0 ? totalPremium / totalCount : 0,
          status_breakdown: statusCounts
        }
      };
    } else if (dataType === 'agents') {
      let query = supabase
        .from('users')
        .select('total_prod, total_policies_sold, status, is_active')
        .eq('agency_id', agencyId)
        .neq('role', 'client');

      // PERMISSION FILTER: Only summarize allowed agents
      if (allowedAgentIds && allowedAgentIds.length > 0) {
        query = query.in('id', allowedAgentIds);
      }

      if (params.agent_id) {
        query = query.eq('id', params.agent_id);
      }
      if (params.status) {
        query = query.eq('status', params.status);
      }

      // Get count first
      let countQuery = supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .neq('role', 'client');

      // PERMISSION FILTER: Apply to count query too
      if (allowedAgentIds && allowedAgentIds.length > 0) {
        countQuery = countQuery.in('id', allowedAgentIds);
      }

      if (params.agent_id) {
        countQuery = countQuery.eq('id', params.agent_id);
      }
      if (params.status) {
        countQuery = countQuery.eq('status', params.status);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        throw new Error('Failed to get agent count');
      }

      const totalCount = count || 0;

      if (totalCount > 1000) {
        const { data: sampleAgents } = await query.limit(1000);

        const totalProduction = sampleAgents?.reduce((sum, agent) => sum + (Number(agent.total_prod) || 0), 0) || 0;
        const totalPolicies = sampleAgents?.reduce((sum, agent) => sum + (Number(agent.total_policies_sold) || 0), 0) || 0;
        const activeAgents = sampleAgents?.filter(a => a.is_active).length || 0;

        return {
          data_type: 'agents',
          total_count: totalCount,
          summary_only: true,
          note: `Dataset exceeds 1000 entries. Showing summary based on sample. Use get_agents_paginated for detailed data.`,
          summary: {
            estimated_total_production: totalProduction * (totalCount / Math.min(totalCount, 1000)),
            estimated_total_policies: totalPolicies * (totalCount / Math.min(totalCount, 1000)),
            active_agents: activeAgents,
            sample_size: Math.min(totalCount, 1000)
          }
        };
      }

      const { data: agents } = await query;
      const totalProduction = agents?.reduce((sum, agent) => sum + (Number(agent.total_prod) || 0), 0) || 0;
      const totalPolicies = agents?.reduce((sum, agent) => sum + (Number(agent.total_policies_sold) || 0), 0) || 0;
      const activeAgents = agents?.filter(a => a.is_active).length || 0;

      return {
        data_type: 'agents',
        total_count: totalCount,
        summary_only: false,
        summary: {
          total_production: totalProduction,
          total_policies: totalPolicies,
          active_agents: activeAgents,
          average_production: totalCount > 0 ? totalProduction / totalCount : 0
        }
      };
    }

    return { error: 'Unsupported data type for summary' };
  } catch (error) {
    console.error('Get data summary error:', error);
    return { error: 'Failed to get data summary' };
  }
}

// Get expected payouts for an agent
export async function getExpectedPayouts(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[],
  userContext?: UserContext
) {
  try {
    const supabase = await createServerClient();

    // Determine which agent to query
    let targetAgentId = params.agent_id;

    // If no agent specified, use the current user
    if (!targetAgentId && userContext) {
      targetAgentId = userContext.user_id;
    }

    // Permission check: ensure target agent is in allowed list (for non-admins)
    if (allowedAgentIds && allowedAgentIds.length > 0 && targetAgentId) {
      if (!allowedAgentIds.includes(targetAgentId)) {
        return {
          error: 'You do not have permission to view payouts for this agent',
          permission_denied: true
        };
      }
    }

    const monthsPast = params.months_past || 12;
    const monthsFuture = params.months_future || 12;
    const carrierId = params.carrier_id || null;
    const includeDebt = params.include_debt !== false; // Default true

    // Call the get_expected_payouts RPC
    const { data: payouts, error: rpcError } = await supabase
      .rpc('get_expected_payouts', {
        p_user_id: userContext?.user_id || targetAgentId,
        p_agent_id: targetAgentId,
        p_months_past: monthsPast,
        p_months_future: monthsFuture,
        p_carrier_id: carrierId
      });

    if (rpcError) {
      console.error('Expected payouts RPC error:', rpcError);
      return { error: `Failed to fetch expected payouts: ${rpcError.message}` };
    }

    // Get deal info to determine writing agent for your vs downline split
    const dealIds = (payouts || []).map((p: any) => p.deal_id);
    let dealAgentMap: Record<string, string> = {};

    if (dealIds.length > 0) {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, agent_id')
        .in('id', dealIds);

      if (deals) {
        dealAgentMap = deals.reduce((acc: Record<string, string>, deal: any) => {
          acc[deal.id] = deal.agent_id;
          return acc;
        }, {});
      }
    }

    // Split into your production vs downline
    const yourProduction: any[] = [];
    const downlineProduction: any[] = [];

    (payouts || []).forEach((payout: any) => {
      const writingAgentId = dealAgentMap[payout.deal_id];
      if (writingAgentId === targetAgentId) {
        yourProduction.push(payout);
      } else {
        downlineProduction.push(payout);
      }
    });

    // Calculate totals
    const calculateTotal = (arr: any[]) =>
      arr.reduce((sum, p) => sum + (parseFloat(p.expected_payout) || 0), 0);

    const yourTotal = calculateTotal(yourProduction);
    const downlineTotal = calculateTotal(downlineProduction);

    // Aggregate by carrier
    const carrierTotals: Record<string, { name: string; total: number; count: number }> = {};
    (payouts || []).forEach((p: any) => {
      const carrierId = p.carrier_id;
      if (!carrierTotals[carrierId]) {
        carrierTotals[carrierId] = { name: p.carrier_name, total: 0, count: 0 };
      }
      carrierTotals[carrierId].total += parseFloat(p.expected_payout) || 0;
      carrierTotals[carrierId].count += 1;
    });

    // Aggregate by month for trends
    const monthlyTotals: Record<string, number> = {};
    (payouts || []).forEach((p: any) => {
      const month = p.month?.substring(0, 7); // YYYY-MM
      if (month) {
        monthlyTotals[month] = (monthlyTotals[month] || 0) + (parseFloat(p.expected_payout) || 0);
      }
    });

    // Optionally get debt
    let debtInfo = null;
    if (includeDebt && targetAgentId) {
      const { data: debtData, error: debtError } = await supabase
        .rpc('get_agent_debt', {
          p_user_id: userContext?.user_id || targetAgentId,
          p_agent_id: targetAgentId
        });

      if (!debtError && debtData?.[0]) {
        debtInfo = {
          total_debt: debtData[0].total_debt || 0,
          lapsed_deals_count: debtData[0].lapsed_deals_count || 0
        };
      }
    }

    // Build summary result (limited for token efficiency)
    const result: any = {
      summary: {
        total_expected_payout: yourTotal + downlineTotal,
        your_production: {
          total: yourTotal,
          deal_count: yourProduction.length
        },
        downline_production: {
          total: downlineTotal,
          deal_count: downlineProduction.length
        },
        net_total: debtInfo
          ? (yourTotal + downlineTotal) - (debtInfo.total_debt || 0)
          : yourTotal + downlineTotal
      },
      by_carrier: Object.entries(carrierTotals)
        .map(([id, data]) => ({
          carrier_id: id,
          carrier_name: data.name,
          total: data.total,
          deal_count: data.count
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10), // Top 10 carriers
      monthly_trend: Object.entries(monthlyTotals)
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12), // Last 12 months
      filters: {
        agent_id: targetAgentId,
        months_past: monthsPast,
        months_future: monthsFuture,
        carrier_id: carrierId
      }
    };

    if (debtInfo) {
      result.debt = debtInfo;
    }

    // Include sample of top payouts (limited to 15 for token efficiency)
    if (payouts && payouts.length > 0) {
      result.top_payouts = payouts
        .sort((a: any, b: any) => (parseFloat(b.expected_payout) || 0) - (parseFloat(a.expected_payout) || 0))
        .slice(0, 15)
        .map((p: any) => ({
          agent_name: p.agent_name,
          carrier_name: p.carrier_name,
          policy_number: p.policy_number,
          annual_premium: p.annual_premium,
          expected_payout: p.expected_payout,
          month: p.month
        }));
      result.total_payout_records = payouts.length;
    }

    return result;
  } catch (error) {
    console.error('Get expected payouts error:', error);
    return { error: 'Failed to get expected payouts' };
  }
}

// Get scoreboard/leaderboard data
export async function getScoreboard(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[],
  userContext?: UserContext
) {
  try {
    const supabase = await createServerClient();

    // Calculate date range
    let startDate: Date;
    let endDate: Date = new Date();

    switch (params.time_range) {
      case 'this_week': {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'last_week': {
        endDate = new Date();
        endDate.setDate(endDate.getDate() - endDate.getDay());
        endDate.setHours(0, 0, 0, 0);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        break;
      }
      case '7_days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '14_days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 14);
        break;
      case '30_days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90_days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'ytd':
        startDate = new Date(new Date().getFullYear(), 0, 1);
        break;
      case 'custom':
        startDate = params.start_date ? new Date(params.start_date) : new Date();
        endDate = params.end_date ? new Date(params.end_date) : new Date();
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
    }

    // Call the scoreboard RPC
    const { data: scoreboardData, error } = await supabase
      .rpc('get_scoreboard_data_updated_lapsed_deals', {
        p_agency_id: agencyId,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0]
      });

    if (error) {
      console.error('Scoreboard RPC error:', error);
      return { error: `Failed to fetch scoreboard: ${error.message}` };
    }

    // Filter by allowed agents if needed
    let filteredData = scoreboardData || [];
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      filteredData = filteredData.filter((row: any) =>
        allowedAgentIds.includes(row.user_id)
      );
    }

    // Calculate rankings and totals
    const rankedData = filteredData
      .map((row: any, index: number) => ({
        rank: index + 1,
        agent_id: row.user_id,
        agent_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        total_production: parseFloat(row.total_submitted_premium) || 0,
        policies_sold: parseInt(row.deal_count) || 0,
        active_policies: parseInt(row.active_count) || 0,
        lapsed_policies: parseInt(row.lapsed_count) || 0
      }))
      .sort((a: any, b: any) => b.total_production - a.total_production)
      .map((row: any, index: number) => ({ ...row, rank: index + 1 }));

    // Calculate totals
    const totalProduction = rankedData.reduce((sum: number, row: any) => sum + row.total_production, 0);
    const totalPolicies = rankedData.reduce((sum: number, row: any) => sum + row.policies_sold, 0);

    return {
      time_range: params.time_range || '7_days',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      rankings: rankedData.slice(0, 25), // Top 25 for token efficiency
      summary: {
        total_agents: rankedData.length,
        total_production: totalProduction,
        total_policies: totalPolicies,
        top_producer: rankedData[0] || null
      },
      note: rankedData.length > 25 ? `Showing top 25 of ${rankedData.length} agents` : undefined
    };
  } catch (error) {
    console.error('Get scoreboard error:', error);
    return { error: 'Failed to get scoreboard data' };
  }
}

// Get clients list
export async function getClients(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[],
  userContext?: UserContext
) {
  try {
    const supabase = await createServerClient();
    const limit = params.limit || 50;
    const searchTerm = params.search?.trim();

    // If search term provided, use fuzzy search for better suggestions
    if (searchTerm && searchTerm.length >= 2) {
      // Try fuzzy RPC first
      const { data: fuzzyData, error: fuzzyError } = await supabase.rpc('search_clients_fuzzy', {
        p_query: searchTerm,
        p_agency_id: agencyId,
        p_allowed_agent_ids: allowedAgentIds?.length ? allowedAgentIds : null,
        p_limit: limit,
        p_similarity_threshold: 0.3
      });

      if (!fuzzyError && fuzzyData) {
        const exactMatches = fuzzyData.filter((r: any) => r.match_type === 'exact' || r.match_type === 'fuzzy') || [];
        const suggestions = fuzzyData.filter((r: any) => r.match_type === 'suggestion') || [];

        // Get full client details for matches
        let clients: any[] = [];
        if (exactMatches.length > 0) {
          const clientIds = exactMatches.map((c: any) => c.id);
          const { data: fullClients } = await supabase
            .from('clients')
            .select(`
              id,
              first_name,
              last_name,
              email,
              phone_number,
              status,
              created_at,
              supporting_agent:users!clients_supporting_agent_id_fkey(id, first_name, last_name, email)
            `)
            .in('id', clientIds);

          if (fullClients) {
            clients = fullClients.map((c: any) => ({
              id: c.id,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              email: c.email,
              phone: c.phone_number,
              status: c.status,
              supporting_agent: c.supporting_agent ?
                `${c.supporting_agent.first_name || ''} ${c.supporting_agent.last_name || ''}`.trim() : null,
              created_at: c.created_at,
              similarity_score: exactMatches.find((m: any) => m.id === c.id)?.similarity_score
            }));
          }
        }

        // Build response with suggestions if no direct matches
        const response: any = {
          clients,
          count: clients.length,
          summary: { status_breakdown: {} },
          filters: { search: searchTerm }
        };

        if (clients.length === 0 && suggestions.length > 0) {
          response.no_exact_match = true;
          response.suggestions = suggestions.slice(0, 5).map((s: any) => ({
            id: s.id,
            name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            email: s.email,
            similarity_score: s.similarity_score
          }));
          response.suggestion_message = formatSuggestionMessage(
            searchTerm,
            suggestions.slice(0, 3).map((s: any) => ({
              name: `${s.first_name || ''} ${s.last_name || ''}`.trim()
            }))
          );
        }

        return response;
      }
      // If fuzzy RPC fails, fall through to standard query
    }

    // Standard query (no search or fuzzy failed)
    let query = supabase
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone_number,
        status,
        created_at,
        updated_at,
        supporting_agent_id,
        supporting_agent:users!clients_supporting_agent_id_fkey(id, first_name, last_name, email)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    // Permission filter: only show clients for allowed agents
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('supporting_agent_id', allowedAgentIds);
    }

    // Apply filters
    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    if (params.agent_id) {
      query = query.eq('supporting_agent_id', params.agent_id);
    }

    if (searchTerm) {
      const sanitizedSearch = searchTerm.replace(/[%_]/g, '\\$&');
      query = query.or(`first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
    }

    const { data: clients, error, count } = await query.limit(limit);

    if (error) {
      console.error('Get clients error:', error);
      return { error: 'Failed to fetch clients' };
    }

    // Calculate status breakdown
    const statusCounts = (clients || []).reduce((acc: any, client: any) => {
      const status = client.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      clients: (clients || []).map((c: any) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email,
        phone: c.phone_number,
        status: c.status,
        supporting_agent: c.supporting_agent ?
          `${c.supporting_agent.first_name || ''} ${c.supporting_agent.last_name || ''}`.trim() : null,
        created_at: c.created_at
      })),
      count: clients?.length || 0,
      summary: {
        status_breakdown: statusCounts
      },
      filters: {
        status: params.status,
        agent_id: params.agent_id,
        search: params.search
      }
    };
  } catch (error) {
    console.error('Get clients error:', error);
    return { error: 'Failed to get clients' };
  }
}

// Get at-risk policies
export async function getAtRiskPolicies(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[],
  userContext?: UserContext
) {
  try {
    const supabase = await createServerClient();
    const daysAhead = params.days_ahead || 30;
    const riskType = params.risk_type || 'all';

    // Try to use the lapse reminder RPC first
    const { data: lapseData, error: lapseError } = await supabase
      .rpc('get_lapse_reminder_deals', {
        p_agency_id: agencyId
      });

    if (lapseError) {
      console.error('Lapse reminder RPC error:', lapseError);
      // Fall back to direct query
    }

    // Also query deals directly for at-risk statuses
    let query = supabase
      .from('deals')
      .select(`
        id,
        policy_number,
        client_name,
        client_phone,
        annual_premium,
        status,
        status_standardized,
        policy_effective_date,
        created_at,
        agent:users!deals_agent_id_fkey(id, first_name, last_name),
        carrier:carriers(id, display_name)
      `)
      .eq('agency_id', agencyId);

    // Filter by agent permissions
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('agent_id', allowedAgentIds);
    }

    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }

    // Filter by risk type
    switch (riskType) {
      case 'lapse_risk':
        query = query.in('status_standardized', ['pending', 'at_risk']);
        break;
      case 'recently_lapsed':
        query = query.eq('status_standardized', 'lapsed');
        break;
      case 'billing_due':
        query = query.in('status_standardized', ['pending', 'billing_issue']);
        break;
      case 'needs_attention':
        query = query.in('status_standardized', ['pending', 'at_risk', 'billing_issue']);
        break;
      case 'all':
      default:
        query = query.in('status_standardized', ['pending', 'at_risk', 'lapsed', 'billing_issue']);
    }

    query = query.order('created_at', { ascending: false }).limit(50);

    const { data: atRiskDeals, error } = await query;

    if (error) {
      console.error('At-risk policies query error:', error);
      return { error: 'Failed to fetch at-risk policies' };
    }

    // Combine with lapse reminder data if available
    let combinedPolicies = (atRiskDeals || []).map((deal: any) => ({
      id: deal.id,
      policy_number: deal.policy_number,
      client_name: deal.client_name,
      client_phone: deal.client_phone,
      annual_premium: deal.annual_premium,
      status: deal.status_standardized || deal.status,
      carrier: deal.carrier?.display_name,
      agent_name: deal.agent ? `${deal.agent.first_name || ''} ${deal.agent.last_name || ''}`.trim() : null,
      policy_effective_date: deal.policy_effective_date,
      risk_reason: determineRiskReason(deal.status_standardized)
    }));

    // Add lapse reminder data if available
    if (lapseData && !lapseError) {
      const lapseFiltered = allowedAgentIds && allowedAgentIds.length > 0
        ? lapseData.filter((d: any) => allowedAgentIds.includes(d.agent_id))
        : lapseData;

      // Merge unique entries
      const existingIds = new Set(combinedPolicies.map((p: any) => p.id));
      lapseFiltered.forEach((d: any) => {
        if (!existingIds.has(d.deal_id)) {
          combinedPolicies.push({
            id: d.deal_id,
            policy_number: d.policy_number,
            client_name: d.client_name,
            annual_premium: d.annual_premium,
            status: d.status,
            carrier: d.carrier_name,
            agent_name: d.agent_name,
            risk_reason: 'Flagged for lapse reminder'
          });
        }
      });
    }

    // Calculate summary
    const statusBreakdown = combinedPolicies.reduce((acc: any, p: any) => {
      const status = p.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const totalAtRiskPremium = combinedPolicies.reduce((sum: number, p: any) =>
      sum + (parseFloat(p.annual_premium) || 0), 0);

    return {
      policies: combinedPolicies.slice(0, 30), // Limit for token efficiency
      count: combinedPolicies.length,
      summary: {
        total_at_risk: combinedPolicies.length,
        total_at_risk_premium: totalAtRiskPremium,
        status_breakdown: statusBreakdown
      },
      filters: {
        risk_type: riskType,
        days_ahead: daysAhead,
        agent_id: params.agent_id
      },
      note: combinedPolicies.length > 30 ? `Showing 30 of ${combinedPolicies.length} at-risk policies` : undefined
    };
  } catch (error) {
    console.error('Get at-risk policies error:', error);
    return { error: 'Failed to get at-risk policies' };
  }
}

function determineRiskReason(status: string): string {
  switch (status) {
    case 'pending': return 'Payment pending';
    case 'at_risk': return 'Policy at risk of lapsing';
    case 'lapsed': return 'Policy has lapsed';
    case 'billing_issue': return 'Billing issue detected';
    default: return 'Requires attention';
  }
}

// Get carrier resources (contact info, portal URLs, support hours)
export async function getCarrierResources(params: any, agencyId: string) {
  try {
    const supabase = await createServerClient();
    const carrierNameQuery = params.carrier_name?.trim();

    // Get active carriers from database
    let carriersQuery = supabase
      .from('carriers')
      .select('id, name, display_name, is_active')
      .eq('is_active', true);

    if (params.carrier_id) {
      carriersQuery = carriersQuery.eq('id', params.carrier_id);
    }

    const { data: carriers, error } = await carriersQuery;

    if (error) {
      console.error('Error fetching carriers:', error);
      return { error: 'Failed to fetch carriers' };
    }

    // Helper to map carrier to resources
    const mapCarrierToResources = (carrier: any) => {
      const carrierKey = carrier.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const displayKey = carrier.display_name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      let resources = CARRIER_RESOURCES[carrierKey] || CARRIER_RESOURCES[displayKey];

      if (!resources) {
        for (const [key, value] of Object.entries(CARRIER_RESOURCES)) {
          if (carrierKey?.includes(key) || key.includes(carrierKey) ||
              displayKey?.includes(key) || key.includes(displayKey)) {
            resources = value;
            break;
          }
        }
      }

      return {
        carrier_id: carrier.id,
        carrier_name: carrier.display_name || carrier.name,
        phone: resources?.phone || null,
        fax: resources?.fax || null,
        email: resources?.email || null,
        support_hours: resources?.support_hours || null,
        website_url: resources?.website_url || null,
        portal_url: resources?.portal_url || null,
        notes: resources?.notes || null,
        has_resources: !!resources
      };
    };

    // If carrier name query provided, use fuzzy matching
    if (carrierNameQuery && carrierNameQuery.length >= 2) {
      const queryLower = carrierNameQuery.toLowerCase();

      // Calculate similarity for each carrier
      const carriersWithSimilarity = (carriers || []).map((c: any) => {
        const nameSim = calculateSimilarity(queryLower, (c.name || '').toLowerCase());
        const displaySim = calculateSimilarity(queryLower, (c.display_name || '').toLowerCase());
        return {
          ...c,
          similarity: Math.max(nameSim, displaySim)
        };
      }).filter((c: any) => c.similarity > 0.3)
        .sort((a: any, b: any) => b.similarity - a.similarity);

      // Check for exact/partial matches (ILIKE behavior)
      const directMatches = carriersWithSimilarity.filter((c: any) =>
        c.name?.toLowerCase().includes(queryLower) ||
        c.display_name?.toLowerCase().includes(queryLower)
      );

      if (directMatches.length > 0) {
        // Found direct matches
        const carrierResources = directMatches.map(mapCarrierToResources);
        return {
          carriers: carrierResources,
          count: carrierResources.length,
          query: carrierNameQuery,
          note: 'Contact information for matching carriers.'
        };
      } else if (carriersWithSimilarity.length > 0) {
        // No direct matches, but have fuzzy suggestions
        const suggestions = carriersWithSimilarity.slice(0, 5).map((c: any) => ({
          carrier_id: c.id,
          carrier_name: c.display_name || c.name,
          similarity_score: c.similarity
        }));

        return {
          carriers: [],
          count: 0,
          query: carrierNameQuery,
          no_exact_match: true,
          suggestions,
          suggestion_message: formatSuggestionMessage(
            carrierNameQuery,
            suggestions.slice(0, 3).map(s => ({ name: s.carrier_name }))
          ),
          note: 'No exact carrier match found. See suggestions for similar carriers.'
        };
      } else {
        // No matches at all
        return {
          carriers: [],
          count: 0,
          query: carrierNameQuery,
          no_exact_match: true,
          note: `No carriers found matching "${carrierNameQuery}".`
        };
      }
    }

    // Standard case: return all carriers with resources
    const carrierResources = (carriers || []).map(mapCarrierToResources);

    // If specific carrier requested, return single result
    if (params.carrier_id && carrierResources.length === 1) {
      return carrierResources[0];
    }

    return {
      carriers: carrierResources,
      count: carrierResources.length,
      note: 'Contact information for active carriers. Some carriers may not have all fields available.'
    };
  } catch (error) {
    console.error('Get carrier resources error:', error);
    return { error: 'Failed to get carrier resources' };
  }
}

// Get user profile and subscription info
export async function getUserProfile(
  params: any,
  agencyId: string,
  userContext?: UserContext
) {
  try {
    const supabase = await createServerClient();

    if (!userContext) {
      return { error: 'User context required' };
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        is_admin,
        total_prod,
        total_policies_sold,
        subscription_tier,
        ai_requests_count,
        messages_sent_count,
        deals_created_count,
        billing_cycle_start,
        billing_cycle_end,
        scheduled_tier_change,
        scheduled_tier_change_date,
        position:positions(id, name, level)
      `)
      .eq('id', userContext.user_id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user profile:', userError);
      return { error: 'Failed to fetch user profile' };
    }

    // Get tier limits
    const tierLimits: Record<string, { ai_requests: number; messages: number; deals: number }> = {
      free: { ai_requests: 0, messages: 0, deals: 10 },
      starter: { ai_requests: 0, messages: 100, deals: 50 },
      pro: { ai_requests: 0, messages: 500, deals: 200 },
      expert: { ai_requests: 50, messages: 1000, deals: 500 }
    };

    const currentTier = userData.subscription_tier || 'free';
    const limits = tierLimits[currentTier] || tierLimits.free;

    // Calculate days until billing cycle reset
    let daysUntilReset = null;
    if (userData.billing_cycle_end) {
      const endDate = new Date(userData.billing_cycle_end);
      const now = new Date();
      daysUntilReset = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      profile: {
        name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
        email: userData.email,
        role: userData.role,
        is_admin: userData.is_admin,
        position: userData.position ? {
          name: (userData.position as any).name,
          level: (userData.position as any).level
        } : null
      },
      subscription: {
        tier: currentTier,
        billing_cycle_start: userData.billing_cycle_start,
        billing_cycle_end: userData.billing_cycle_end,
        days_until_reset: daysUntilReset,
        scheduled_change: userData.scheduled_tier_change ? {
          new_tier: userData.scheduled_tier_change,
          change_date: userData.scheduled_tier_change_date
        } : null
      },
      usage: {
        ai_requests_used: userData.ai_requests_count || 0,
        ai_requests_limit: limits.ai_requests,
        ai_requests_remaining: Math.max(0, limits.ai_requests - (userData.ai_requests_count || 0)),
        messages_sent: userData.messages_sent_count || 0,
        messages_limit: limits.messages,
        deals_created: userData.deals_created_count || 0,
        deals_limit: limits.deals
      },
      production: {
        total_production: userData.total_prod || 0,
        total_policies_sold: userData.total_policies_sold || 0
      }
    };
  } catch (error) {
    console.error('Get user profile error:', error);
    return { error: 'Failed to get user profile' };
  }
}

// Get lead source analytics
export async function getLeadSourceAnalytics(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[]
) {
  try {
    const supabase = await createServerClient();

    let query = supabase
      .from('deals')
      .select('id, lead_source, annual_premium, status_standardized, created_at')
      .eq('agency_id', agencyId);

    // Permission filter
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('agent_id', allowedAgentIds);
    }

    // Date range filter
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    // Agent filter
    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }

    const { data: deals, error } = await query;

    if (error) {
      console.error('Error fetching lead source data:', error);
      return { error: 'Failed to fetch lead source analytics' };
    }

    // Aggregate by lead source
    const leadSourceStats: Record<string, {
      count: number;
      active_count: number;
      total_premium: number;
    }> = {};

    (deals || []).forEach((deal: any) => {
      const source = deal.lead_source || 'unknown';
      if (!leadSourceStats[source]) {
        leadSourceStats[source] = { count: 0, active_count: 0, total_premium: 0 };
      }
      leadSourceStats[source].count++;
      if (deal.status_standardized === 'active') {
        leadSourceStats[source].active_count++;
      }
      leadSourceStats[source].total_premium += parseFloat(deal.annual_premium) || 0;
    });

    const totalDeals = deals?.length || 0;

    // Format for response
    const leadSources = Object.entries(leadSourceStats)
      .map(([source, stats]) => ({
        lead_source: source,
        display_name: source.charAt(0).toUpperCase() + source.slice(1).replace(/-/g, ' '),
        count: stats.count,
        percentage: totalDeals > 0 ? ((stats.count / totalDeals) * 100).toFixed(1) : '0',
        active_count: stats.active_count,
        conversion_rate: stats.count > 0
          ? ((stats.active_count / stats.count) * 100).toFixed(1)
          : '0',
        total_premium: stats.total_premium,
        avg_premium: stats.count > 0 ? stats.total_premium / stats.count : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Find top performer
    const topSource = leadSources[0] || null;

    return {
      lead_sources: leadSources,
      summary: {
        total_deals: totalDeals,
        total_sources: leadSources.length,
        top_source: topSource ? topSource.lead_source : null,
        top_source_percentage: topSource ? topSource.percentage : null
      },
      filters: {
        start_date: params.start_date,
        end_date: params.end_date,
        agent_id: params.agent_id
      }
    };
  } catch (error) {
    console.error('Get lead source analytics error:', error);
    return { error: 'Failed to get lead source analytics' };
  }
}

// Get production trends over time
export async function getProductionTrends(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[]
) {
  try {
    const supabase = await createServerClient();

    const timeRange = params.time_range || 'monthly'; // daily, weekly, monthly
    const periods = params.periods || 12;

    let query = supabase
      .from('deals')
      .select('id, annual_premium, created_at, status_standardized, agent_id')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true });

    // Permission filter
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('agent_id', allowedAgentIds);
    }

    // Agent filter
    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }

    // Calculate date range based on periods
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - periods);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (periods * 7));
        break;
      case 'monthly':
      default:
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - periods);
        break;
    }

    query = query.gte('created_at', startDate.toISOString());

    const { data: deals, error } = await query;

    if (error) {
      console.error('Error fetching production trends:', error);
      return { error: 'Failed to fetch production trends' };
    }

    // Aggregate by time period
    const trendData: Record<string, { production: number; policies_count: number; active_count: number }> = {};

    (deals || []).forEach((deal: any) => {
      const date = new Date(deal.created_at);
      let periodKey: string;

      switch (timeRange) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get ISO week
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          periodKey = startOfWeek.toISOString().split('T')[0];
          break;
        case 'monthly':
        default:
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
          break;
      }

      if (!trendData[periodKey]) {
        trendData[periodKey] = { production: 0, policies_count: 0, active_count: 0 };
      }
      trendData[periodKey].production += parseFloat(deal.annual_premium) || 0;
      trendData[periodKey].policies_count++;
      if (deal.status_standardized === 'active') {
        trendData[periodKey].active_count++;
      }
    });

    // Convert to array and sort
    const trends = Object.entries(trendData)
      .map(([period, data]) => ({
        period,
        production: data.production,
        policies_count: data.policies_count,
        active_count: data.active_count
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-periods); // Limit to requested periods

    // Calculate summary stats
    const totalProduction = trends.reduce((sum, t) => sum + t.production, 0);
    const totalPolicies = trends.reduce((sum, t) => sum + t.policies_count, 0);
    const avgProduction = trends.length > 0 ? totalProduction / trends.length : 0;

    // Calculate growth rate (compare first and last period)
    let growthRate = null;
    if (trends.length >= 2) {
      const firstPeriod = trends[0].production;
      const lastPeriod = trends[trends.length - 1].production;
      if (firstPeriod > 0) {
        growthRate = ((lastPeriod - firstPeriod) / firstPeriod * 100).toFixed(1);
      }
    }

    // Find best period
    const bestPeriod = trends.reduce((best, t) =>
      t.production > (best?.production || 0) ? t : best,
      trends[0]
    );

    return {
      data: trends,
      summary: {
        total_production: totalProduction,
        total_policies: totalPolicies,
        average_production: avgProduction,
        growth_rate: growthRate,
        best_period: bestPeriod?.period,
        best_period_production: bestPeriod?.production
      },
      filters: {
        time_range: timeRange,
        periods: periods,
        agent_id: params.agent_id
      }
    };
  } catch (error) {
    console.error('Get production trends error:', error);
    return { error: 'Failed to get production trends' };
  }
}

// Get carrier distribution (policy count and premium by carrier)
export async function getCarrierDistribution(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[]
) {
  try {
    const supabase = await createServerClient();

    let query = supabase
      .from('deals')
      .select(`
        id,
        annual_premium,
        status_standardized,
        carrier:carriers(id, name, display_name)
      `)
      .eq('agency_id', agencyId);

    // Permission filter
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      query = query.in('agent_id', allowedAgentIds);
    }

    // Status filter
    if (params.status && params.status !== 'all') {
      query = query.eq('status_standardized', params.status);
    }

    // Agent filter
    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }

    const { data: deals, error } = await query;

    if (error) {
      console.error('Error fetching carrier distribution:', error);
      return { error: 'Failed to fetch carrier distribution' };
    }

    // Aggregate by carrier
    const carrierStats: Record<string, {
      name: string;
      count: number;
      active_count: number;
      total_premium: number;
    }> = {};

    (deals || []).forEach((deal: any) => {
      const carrierId = deal.carrier?.id || 'unknown';
      const carrierName = deal.carrier?.display_name || deal.carrier?.name || 'Unknown';

      if (!carrierStats[carrierId]) {
        carrierStats[carrierId] = { name: carrierName, count: 0, active_count: 0, total_premium: 0 };
      }
      carrierStats[carrierId].count++;
      if (deal.status_standardized === 'active') {
        carrierStats[carrierId].active_count++;
      }
      carrierStats[carrierId].total_premium += parseFloat(deal.annual_premium) || 0;
    });

    const totalPolicies = deals?.length || 0;
    const totalPremium = Object.values(carrierStats).reduce((sum, s) => sum + s.total_premium, 0);

    // Format distribution for visualization
    const distribution = Object.entries(carrierStats)
      .map(([id, stats]) => ({
        carrier_id: id,
        carrier_name: stats.name,
        count: stats.count,
        percentage: totalPolicies > 0 ? ((stats.count / totalPolicies) * 100).toFixed(1) : '0',
        active_count: stats.active_count,
        total_premium: stats.total_premium,
        premium_percentage: totalPremium > 0 ? ((stats.total_premium / totalPremium) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.count - a.count);

    return {
      distribution: distribution,
      summary: {
        total_policies: totalPolicies,
        total_premium: totalPremium,
        carrier_count: distribution.length,
        top_carrier: distribution[0]?.carrier_name || null,
        top_carrier_percentage: distribution[0]?.percentage || null
      },
      filters: {
        status: params.status,
        agent_id: params.agent_id
      }
    };
  } catch (error) {
    console.error('Get carrier distribution error:', error);
    return { error: 'Failed to get carrier distribution' };
  }
}

// Get comprehensive analytics snapshot
export async function getAnalyticsSnapshot(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[],
  userContext?: UserContext
) {
  try {
    const supabase = await createServerClient();

    // Calculate date ranges
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (params.time_period) {
      case 'current_month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_month':
        currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
        break;
      case 'ytd':
        currentStart = new Date(now.getFullYear(), 0, 1);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default: // 'all'
        currentStart = new Date(0);
        previousStart = new Date(0);
        previousEnd = new Date(0);
    }

    // Get current period deals
    let currentQuery = supabase
      .from('deals')
      .select('id, annual_premium, status_standardized, created_at')
      .eq('agency_id', agencyId)
      .gte('created_at', currentStart.toISOString());

    if (allowedAgentIds && allowedAgentIds.length > 0) {
      currentQuery = currentQuery.in('agent_id', allowedAgentIds);
    }

    const { data: currentDeals, error: currentError } = await currentQuery;

    if (currentError) {
      console.error('Error fetching current deals:', currentError);
      return { error: 'Failed to fetch analytics snapshot' };
    }

    // Get previous period deals for comparison
    let previousQuery = supabase
      .from('deals')
      .select('id, annual_premium, status_standardized')
      .eq('agency_id', agencyId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    if (allowedAgentIds && allowedAgentIds.length > 0) {
      previousQuery = previousQuery.in('agent_id', allowedAgentIds);
    }

    const { data: previousDeals } = await previousQuery;

    // Get agents count
    let agentsQuery = supabase
      .from('users')
      .select('id, is_active, total_prod')
      .eq('agency_id', agencyId)
      .neq('role', 'client');

    if (allowedAgentIds && allowedAgentIds.length > 0) {
      agentsQuery = agentsQuery.in('id', allowedAgentIds);
    }

    const { data: agents } = await agentsQuery;

    // Get clients count
    let clientsQuery = supabase
      .from('clients')
      .select('id, created_at')
      .eq('agency_id', agencyId);

    if (allowedAgentIds && allowedAgentIds.length > 0) {
      clientsQuery = clientsQuery.in('supporting_agent_id', allowedAgentIds);
    }

    const { data: clients } = await clientsQuery;

    // Calculate metrics
    const currentProduction = (currentDeals || []).reduce((sum, d: any) => sum + (parseFloat(d.annual_premium) || 0), 0);
    const previousProduction = (previousDeals || []).reduce((sum, d: any) => sum + (parseFloat(d.annual_premium) || 0), 0);
    const productionChange = previousProduction > 0
      ? ((currentProduction - previousProduction) / previousProduction * 100).toFixed(1)
      : null;

    const activePolicies = (currentDeals || []).filter((d: any) => d.status_standardized === 'active').length;
    const lapsedPolicies = (currentDeals || []).filter((d: any) => d.status_standardized === 'lapsed').length;
    const newPolicies = currentDeals?.length || 0;

    const totalAgents = agents?.length || 0;
    const activeAgents = agents?.filter((a: any) => a.is_active).length || 0;
    const topAgent = agents?.reduce((best: any, a: any) =>
      (a.total_prod || 0) > (best?.total_prod || 0) ? a : best,
      agents?.[0]
    );

    const totalClients = clients?.length || 0;
    const newClients = (clients || []).filter((c: any) => {
      const createdAt = new Date(c.created_at);
      return createdAt >= currentStart;
    }).length;

    return {
      production: {
        total: currentProduction,
        previous_period: previousProduction,
        change_percent: productionChange,
        trend: productionChange !== null ? (parseFloat(productionChange) >= 0 ? 'up' : 'down') : null
      },
      policies: {
        total: newPolicies,
        active: activePolicies,
        lapsed: lapsedPolicies,
        active_rate: newPolicies > 0 ? ((activePolicies / newPolicies) * 100).toFixed(1) : '0'
      },
      agents: {
        total: totalAgents,
        active: activeAgents,
        top_performer: topAgent ? {
          id: topAgent.id,
          production: topAgent.total_prod || 0
        } : null
      },
      clients: {
        total: totalClients,
        new: newClients
      },
      time_period: params.time_period || 'all',
      period_start: currentStart.toISOString().split('T')[0],
      period_end: now.toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Get analytics snapshot error:', error);
    return { error: 'Failed to get analytics snapshot' };
  }
}

// Get commission structure
export async function getCommissionStructure(
  params: any,
  agencyId: string
) {
  try {
    const supabase = await createServerClient();

    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_position_product_commissions', {
        p_agency_id: agencyId
      });

    if (!rpcError && rpcData) {
      // Filter by position/product if specified
      let filtered = rpcData;
      if (params.position_id) {
        filtered = filtered.filter((r: any) => r.position_id === params.position_id);
      }
      if (params.product_id) {
        filtered = filtered.filter((r: any) => r.product_id === params.product_id);
      }

      // Group by position for better readability
      const byPosition: Record<string, any[]> = {};
      filtered.forEach((row: any) => {
        const posName = row.position_name || 'Unknown';
        if (!byPosition[posName]) {
          byPosition[posName] = [];
        }
        byPosition[posName].push({
          product: row.product_name,
          carrier: row.carrier_name,
          commission_percentage: row.commission_percentage,
          override_percentage: row.override_percentage
        });
      });

      return {
        commissions: filtered.slice(0, 50), // Limit for token efficiency
        by_position: byPosition,
        count: filtered.length,
        filters: {
          position_id: params.position_id,
          product_id: params.product_id
        }
      };
    }

    // Fallback: query tables directly
    let query = supabase
      .from('position_product_commissions')
      .select(`
        id,
        commission_percentage,
        override_percentage,
        position:positions(id, name, level),
        product:products(id, name, carrier:carriers(id, display_name))
      `)
      .eq('agency_id', agencyId);

    if (params.position_id) {
      query = query.eq('position_id', params.position_id);
    }
    if (params.product_id) {
      query = query.eq('product_id', params.product_id);
    }

    const { data: commissions, error } = await query.limit(100);

    if (error) {
      console.error('Commission structure query error:', error);
      return { error: 'Failed to fetch commission structure' };
    }

    // Format response
    const formatted = (commissions || []).map((c: any) => ({
      position: c.position?.name,
      position_level: c.position?.level,
      product: c.product?.name,
      carrier: c.product?.carrier?.display_name,
      commission_percentage: c.commission_percentage,
      override_percentage: c.override_percentage
    }));

    // Group by position
    const byPosition: Record<string, any[]> = {};
    formatted.forEach((row: any) => {
      const posName = row.position || 'Unknown';
      if (!byPosition[posName]) {
        byPosition[posName] = [];
      }
      byPosition[posName].push(row);
    });

    return {
      commissions: formatted.slice(0, 50),
      by_position: byPosition,
      count: formatted.length,
      filters: {
        position_id: params.position_id,
        product_id: params.product_id
      }
    };
  } catch (error) {
    console.error('Get commission structure error:', error);
    return { error: 'Failed to get commission structure' };
  }
}

// Get positions hierarchy
export async function getPositions(
  params: any,
  agencyId: string
) {
  try {
    const supabase = await createServerClient();

    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_positions_for_agency', {
        p_agency_id: agencyId
      });

    if (!rpcError && rpcData) {
      const positions = rpcData.map((p: any) => ({
        id: p.id,
        name: p.name,
        level: p.level,
        description: p.description
      })).sort((a: any, b: any) => (a.level || 0) - (b.level || 0));

      return {
        positions: positions,
        count: positions.length,
        hierarchy: positions.map((p: any) => `Level ${p.level}: ${p.name}`).join(' → ')
      };
    }

    // Fallback: query positions table directly
    const { data: positions, error } = await supabase
      .from('positions')
      .select('id, name, level, description')
      .eq('agency_id', agencyId)
      .order('level', { ascending: true });

    if (error) {
      console.error('Positions query error:', error);
      return { error: 'Failed to fetch positions' };
    }

    const formatted = (positions || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      level: p.level,
      description: p.description
    }));

    return {
      positions: formatted,
      count: formatted.length,
      hierarchy: formatted.map((p: any) => `Level ${p.level}: ${p.name}`).join(' → ')
    };
  } catch (error) {
    console.error('Get positions error:', error);
    return { error: 'Failed to get positions' };
  }
}

// Get draft messages
export async function getDraftMessages(
  params: any,
  agencyId: string,
  allowedAgentIds?: string[],
  userContext?: UserContext
) {
  try {
    const supabase = await createServerClient();
    const status = params.status || 'pending';
    const isAdmin = !userContext || userContext.is_admin;

    // Use appropriate RPC based on user role
    let drafts: any[] = [];
    let rpcError = null;

    if (isAdmin) {
      // Admin can see all drafts
      const { data, error } = await supabase
        .rpc('get_draft_messages_all', {
          p_agency_id: agencyId
        });
      drafts = data || [];
      rpcError = error;
    } else if (userContext && userContext.downline_agent_ids.length > 0) {
      // User with downline can see their own + downline drafts
      const { data, error } = await supabase
        .rpc('get_draft_messages_downlines', {
          p_user_id: userContext.user_id
        });
      drafts = data || [];
      rpcError = error;
    } else {
      // Regular user can only see their own drafts
      const { data, error } = await supabase
        .rpc('get_draft_messages_self', {
          p_user_id: userContext?.user_id
        });
      drafts = data || [];
      rpcError = error;
    }

    if (rpcError) {
      console.error('Draft messages RPC error:', rpcError);
      // Fallback to direct query
      let query = supabase
        .from('draft_messages')
        .select(`
          id,
          body,
          status,
          created_at,
          updated_at,
          created_by:users!draft_messages_created_by_fkey(id, first_name, last_name),
          conversation:conversations(id, client_phone)
        `)
        .eq('agency_id', agencyId);

      if (allowedAgentIds && allowedAgentIds.length > 0) {
        query = query.in('created_by', allowedAgentIds);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
      if (!error) {
        drafts = data || [];
      }
    }

    // Filter by status if specified
    if (status && status !== 'all') {
      drafts = drafts.filter((d: any) => d.status === status);
    }

    // Filter by agent if specified
    if (params.agent_id) {
      drafts = drafts.filter((d: any) =>
        d.created_by_id === params.agent_id || d.created_by?.id === params.agent_id
      );
    }

    // Format response
    const formatted = drafts.map((d: any) => ({
      id: d.id,
      body: d.body?.substring(0, 200) + (d.body?.length > 200 ? '...' : ''), // Truncate for token efficiency
      status: d.status,
      created_at: d.created_at,
      created_by: d.created_by ?
        `${d.created_by.first_name || ''} ${d.created_by.last_name || ''}`.trim() :
        d.agent_name,
      client_phone: d.conversation?.client_phone || d.client_phone
    }));

    // Calculate status breakdown
    const statusBreakdown = drafts.reduce((acc: any, d: any) => {
      const s = d.status || 'unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    return {
      drafts: formatted.slice(0, 30),
      count: formatted.length,
      summary: {
        status_breakdown: statusBreakdown,
        pending_count: statusBreakdown['pending'] || 0
      },
      filters: {
        status: status,
        agent_id: params.agent_id
      },
      note: formatted.length > 30 ? `Showing 30 of ${formatted.length} draft messages` : undefined
    };
  } catch (error) {
    console.error('Get draft messages error:', error);
    return { error: 'Failed to get draft messages' };
  }
}

// Main executor function - now accepts userContext for permission-based filtering
export async function executeToolCall(
  toolName: string,
  input: any,
  agencyId: string,
  userContext?: UserContext
) {
  // Extract allowed agent IDs from permission-filtered input
  const allowedAgentIds = input.__allowed_agent_ids;
  const scopeEnforced = input.__scope_enforced;

  // Remove internal fields before passing to tool
  const cleanInput = { ...input };
  delete cleanInput.__allowed_agent_ids;
  delete cleanInput.__scope_enforced;

  switch (toolName) {
    case 'get_deals':
      return await getDeals(cleanInput, agencyId, allowedAgentIds);
    case 'get_agents':
      return await getAgents(cleanInput, agencyId, allowedAgentIds);
    case 'get_persistency_analytics':
      return await getPersistencyAnalytics(cleanInput, agencyId, userContext);
    case 'get_conversations_data':
      return await getConversationsData(cleanInput, agencyId, allowedAgentIds);
    case 'get_carriers_and_products':
      return await getCarriersAndProducts(cleanInput, agencyId);
    case 'get_agency_summary':
      return await getAgencySummary(cleanInput, agencyId);
    case 'search_agents':
      return await searchAgents(cleanInput, agencyId, allowedAgentIds);
    case 'search_clients':
      return await searchClients(cleanInput, agencyId, allowedAgentIds);
    case 'search_policies':
      return await searchPolicies(cleanInput, agencyId, allowedAgentIds);
    case 'get_agent_hierarchy':
      return await getAgentHierarchy(cleanInput, agencyId);
    case 'compare_hierarchies':
      return await compareHierarchies(cleanInput, agencyId);
    case 'get_deals_paginated':
      return await getDealsPaginated(cleanInput, agencyId, cleanInput.cursor, allowedAgentIds);
    case 'get_agents_paginated':
      return await getAgentsPaginated(cleanInput, agencyId, cleanInput.cursor, allowedAgentIds);
    case 'get_data_summary':
      return await getDataSummary(cleanInput, agencyId, allowedAgentIds);
    case 'get_expected_payouts':
      return await getExpectedPayouts(cleanInput, agencyId, allowedAgentIds, userContext);
    case 'create_visualization':
      // Generate dynamic visualization with chartcode
      try {
        const vizInput: VisualizationInput = {
          chart_type: cleanInput.chart_type,
          title: cleanInput.title,
          description: cleanInput.description,
          data: cleanInput.data,
          x_axis_key: cleanInput.x_axis_key,
          y_axis_keys: cleanInput.y_axis_keys,
          config: cleanInput.config
        };
        return generateVisualization(vizInput);
      } catch (error: any) {
        return { error: error.message || 'Failed to generate visualization' };
      }
    case 'get_scoreboard':
      return await getScoreboard(cleanInput, agencyId, allowedAgentIds, userContext);
    case 'get_clients':
      return await getClients(cleanInput, agencyId, allowedAgentIds, userContext);
    case 'get_at_risk_policies':
      return await getAtRiskPolicies(cleanInput, agencyId, allowedAgentIds, userContext);
    case 'get_commission_structure':
      return await getCommissionStructure(cleanInput, agencyId);
    case 'get_positions':
      return await getPositions(cleanInput, agencyId);
    case 'get_draft_messages':
      return await getDraftMessages(cleanInput, agencyId, allowedAgentIds, userContext);
    case 'get_carrier_resources':
      return await getCarrierResources(cleanInput, agencyId);
    case 'get_user_profile':
      return await getUserProfile(cleanInput, agencyId, userContext);
    case 'get_lead_source_analytics':
      return await getLeadSourceAnalytics(cleanInput, agencyId, allowedAgentIds);
    case 'get_production_trends':
      return await getProductionTrends(cleanInput, agencyId, allowedAgentIds);
    case 'get_carrier_distribution':
      return await getCarrierDistribution(cleanInput, agencyId, allowedAgentIds);
    case 'get_analytics_snapshot':
      return await getAnalyticsSnapshot(cleanInput, agencyId, allowedAgentIds, userContext);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

