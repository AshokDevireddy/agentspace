import { createServerClient } from '@/lib/supabase/server';
import { UserContext } from '@/lib/ai-permissions';
import { generateVisualization, VisualizationInput } from '@/lib/ai-visualization-tool';

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

    // Sanitize search query
    const sanitizedQuery = query.trim().replace(/[%_]/g, '\\$&');
    const searchWords = sanitizedQuery.split(/\s+/).filter((word: string) => word.length > 0);

    // Build OR conditions
    const orConditions = [];
    orConditions.push(`first_name.ilike.%${sanitizedQuery}%`);
    orConditions.push(`last_name.ilike.%${sanitizedQuery}%`);
    orConditions.push(`email.ilike.%${sanitizedQuery}%`);

    if (searchWords.length > 1) {
      for (const word of searchWords) {
        const sanitizedWord = word.replace(/[%_]/g, '\\$&');
        orConditions.push(`first_name.ilike.%${sanitizedWord}%`);
        orConditions.push(`last_name.ilike.%${sanitizedWord}%`);
        orConditions.push(`email.ilike.%${sanitizedWord}%`);
      }
    }

    let searchQuery = supabase
      .from('users')
      .select('id, first_name, last_name, email, status, total_prod, total_policies_sold')
      .eq('agency_id', agencyId)
      .neq('role', 'client')
      .or(orConditions.join(','))
      .order('last_name', { ascending: true })
      .limit(limit);

    // PERMISSION FILTER: Only search within allowed agents
    if (allowedAgentIds && allowedAgentIds.length > 0) {
      searchQuery = searchQuery.in('id', allowedAgentIds);
    }

    const { data: agents, error } = await searchQuery;

    if (error) {
      console.error('Error searching agents:', error);
      throw new Error('Failed to search agents');
    }

    // Filter multi-word searches client-side
    let filteredAgents = agents || [];
    if (searchWords.length > 1) {
      filteredAgents = filteredAgents.filter(agent => {
        const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase();
        const email = agent.email ? agent.email.toLowerCase() : '';
        const queryLower = sanitizedQuery.toLowerCase();

        if (fullName.includes(queryLower) || email.includes(queryLower)) {
          return true;
        }

        return searchWords.every((word: string) => {
          const wordLower = word.toLowerCase();
          return fullName.includes(wordLower) || email.includes(wordLower);
        });
      });
    }

    return {
      agents: filteredAgents.slice(0, limit),
      count: filteredAgents.length,
      query: query
    };
  } catch (error) {
    console.error('Search agents error:', error);
    return { error: 'Failed to search agents' };
  }
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

    // Sanitize search query
    const sanitizedQuery = query.trim().replace(/[%_]/g, '\\$&');
    const searchWords = sanitizedQuery.split(/\s+/).filter((word: string) => word.length > 0);

    // Build OR conditions
    const orConditions = [];
    orConditions.push(`first_name.ilike.%${sanitizedQuery}%`);
    orConditions.push(`last_name.ilike.%${sanitizedQuery}%`);
    orConditions.push(`email.ilike.%${sanitizedQuery}%`);
    orConditions.push(`phone_number.ilike.%${sanitizedQuery}%`);

    if (searchWords.length > 1) {
      for (const word of searchWords) {
        const sanitizedWord = word.replace(/[%_]/g, '\\$&');
        orConditions.push(`first_name.ilike.%${sanitizedWord}%`);
        orConditions.push(`last_name.ilike.%${sanitizedWord}%`);
        orConditions.push(`email.ilike.%${sanitizedWord}%`);
        orConditions.push(`phone_number.ilike.%${sanitizedWord}%`);
      }
    }

    let searchQuery = supabase
      .from('users')
      .select('id, first_name, last_name, email, phone_number, status')
      .eq('agency_id', agencyId)
      .eq('role', 'client')
      .or(orConditions.join(','))
      .order('last_name', { ascending: true })
      .limit(limit);

    const { data: clients, error } = await searchQuery;

    if (error) {
      console.error('Error searching clients:', error);
      throw new Error('Failed to search clients');
    }

    // Filter multi-word searches client-side
    let filteredClients = clients || [];
    if (searchWords.length > 1) {
      filteredClients = filteredClients.filter(client => {
        const fullName = `${client.first_name} ${client.last_name}`.toLowerCase();
        const email = client.email ? client.email.toLowerCase() : '';
        const phone = client.phone_number ? client.phone_number.toLowerCase() : '';
        const queryLower = sanitizedQuery.toLowerCase();

        if (fullName.includes(queryLower) || email.includes(queryLower) || phone.includes(queryLower)) {
          return true;
        }

        return searchWords.every((word: string) => {
          const wordLower = word.toLowerCase();
          return fullName.includes(wordLower) || email.includes(wordLower) || phone.includes(wordLower);
        });
      });
    }

    return {
      clients: filteredClients.slice(0, limit),
      count: filteredClients.length,
      query: query
    };
  } catch (error) {
    console.error('Search clients error:', error);
    return { error: 'Failed to search clients' };
  }
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

    // Sanitize search query
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
      throw new Error('Failed to search policies');
    }

    return {
      policies: deals || [],
      count: deals?.length || 0,
      query: query
    };
  } catch (error) {
    console.error('Search policies error:', error);
    return { error: 'Failed to search policies' };
  }
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

    if (params.search) {
      const searchTerm = params.search.trim().replace(/[%_]/g, '\\$&');
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
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
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

