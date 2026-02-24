import { getBackendUrl } from '@/lib/api-config';
import camelcaseKeys from 'camelcase-keys';

// Helper to call Django API with authentication
// Transforms snake_case responses to camelCase for consistency
async function fetchDjangoApi<T>(
  endpoint: string,
  accessToken: string,
  options: { method?: string; body?: any; params?: Record<string, any> } = {}
): Promise<T> {
  const { method = 'GET', body, params } = options;

  let url = `${getBackendUrl()}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`Django API error: ${response.status}`);
  }

  const data = await response.json();
  return camelcaseKeys(data, { deep: true }) as T;
}

// Get deals/policies data
export async function getDeals(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    // Build query params for Django API
    const queryParams: Record<string, any> = {
      limit: params.limit || 100,
    };

    if (params.status && params.status !== 'all') {
      queryParams.status = params.status;
    }
    if (params.agent_id) {
      queryParams.agent_id = params.agent_id;
    }
    if (params.carrier_id) {
      queryParams.carrier_id = params.carrier_id;
    }
    if (params.start_date) {
      queryParams.start_date = params.start_date;
    }
    if (params.end_date) {
      queryParams.end_date = params.end_date;
    }

    const data = await fetchDjangoApi<any>('/api/deals/', accessToken, { params: queryParams });

    // Handle both paginated response and direct array
    const deals = Array.isArray(data) ? data : (data.deals || data.results || []);

    // Calculate aggregates
    const totalPremium = deals.reduce((sum: number, deal: any) => sum + (Number(deal.annualPremium) || 0), 0);
    const avgPremium = deals.length > 0 ? totalPremium / deals.length : 0;
    const statusCounts = deals.reduce((acc: any, deal: any) => {
      const status = deal.statusStandardized || deal.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Limit data to prevent token overflow - only return first 20 deals for context
    return {
      deals: deals.slice(0, 20),
      count: deals.length,
      summary: {
        totalAnnualPremium: totalPremium,
        averagePremium: avgPremium,
        statusBreakdown: statusCounts
      },
      note: deals.length > 20 ? `Showing 20 of ${deals.length} deals. Summary statistics include all deals.` : undefined
    };
  } catch (error) {
    console.error('Get deals error:', error);
    return { error: 'Failed to get deals' };
  }
}

// Get agents data
export async function getAgents(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    // Build query params for Django API
    const queryParams: Record<string, any> = {
      limit: params.top_performers ? (params.limit || 10) : (params.limit || 100),
    };

    if (params.agent_id) {
      queryParams.agent_id = params.agent_id;
    }

    const data = await fetchDjangoApi<any>('/api/agents/', accessToken, { params: queryParams });

    // Handle response structure
    const agents = Array.isArray(data) ? data : (data.agents || data.results || []);

    // Get downlines if requested
    let agentsWithDownlines = agents;
    if (params.include_downlines && params.agent_id) {
      try {
        const downlineData = await fetchDjangoApi<any>(
          `/api/agents/${params.agent_id}/downline`,
          accessToken
        );
        const downlines = downlineData.downlines || [];

        agentsWithDownlines = agents.map((agent: any) => ({
          ...agent,
          downlines: agent.id === params.agent_id ? downlines : []
        }));
      } catch {
        // If downline fetch fails, continue without downlines
      }
    }

    // Calculate summary
    const totalProduction = agents.reduce((sum: number, agent: any) => sum + (Number(agent.totalProd) || 0), 0);
    const totalPolicies = agents.reduce((sum: number, agent: any) => sum + (Number(agent.totalPoliciesSold) || 0), 0);
    const avgProduction = agents.length > 0 ? totalProduction / agents.length : 0;

    // Limit data to prevent token overflow - only return top 25 agents for context
    const limitedAgents = agentsWithDownlines.slice(0, 25);

    return {
      agents: limitedAgents,
      count: agents.length,
      summary: {
        totalProduction: totalProduction,
        totalPolicies: totalPolicies,
        averageProduction: avgProduction,
        activeAgents: agents.filter((a: any) => a.isActive).length
      },
      note: agents.length > 25 ? `Showing top 25 of ${agents.length} agents. Summary statistics include all agents.` : undefined
    };
  } catch (error) {
    console.error('Get agents error:', error);
    return { error: 'Failed to get agents' };
  }
}

// Get conversations data
export async function getConversationsData(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const dateRangeDays = params.date_range_days || 30;
    const limit = params.limit || 100;

    // Call Django API for conversations
    const queryParams: Record<string, any> = {
      limit,
      view_mode: 'all', // Get all conversations for agency
    };

    if (params.search) {
      queryParams.search = params.search;
    }

    const data = await fetchDjangoApi<any>('/api/sms/conversations/', accessToken, { params: queryParams });

    // Handle response structure
    const conversations = data.conversations || data.results || [];

    // Get messages if requested
    let messagesData = null;
    if (params.include_messages && conversations.length > 0) {
      // Get messages for first few conversations only to limit token usage
      const conversationIds = conversations.slice(0, 5).map((c: any) => c.id);
      const allMessages: any[] = [];

      for (const convId of conversationIds) {
        try {
          const messagesResponse = await fetchDjangoApi<any>(
            '/api/sms/messages/',
            accessToken,
            { params: { conversation_id: convId, limit: 20 } }
          );
          const messages = messagesResponse.messages || messagesResponse.results || [];
          allMessages.push(...messages.slice(0, 10));
        } catch {
          // Continue if message fetch fails
        }
      }
      messagesData = allMessages;
    }

    // Calculate summary
    const totalConversations = data.total || conversations.length;
    const activeConversations = conversations.filter((c: any) => c.isActive).length;
    const optedInCount = conversations.filter((c: any) => c.smsOptInStatus === 'opted_in').length;

    // Limit data to prevent token overflow
    const limitedConversations = conversations.slice(0, 15);

    return {
      conversations: limitedConversations,
      messages: messagesData,
      summary: {
        totalConversations: totalConversations,
        activeConversations: activeConversations,
        optedInClients: optedInCount,
        dateRangeDays: dateRangeDays
      },
      note: totalConversations > 15 ? `Showing 15 of ${totalConversations} conversations.` : undefined
    };
  } catch (error) {
    console.error('Get conversations error:', error);
    return { error: 'Failed to get conversations data' };
  }
}

// Get carriers and products
export async function getCarriersAndProducts(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    // Get carriers with products from Django API
    const data = await fetchDjangoApi<any>('/api/carriers/with-products', accessToken);

    // Handle response - Django returns array of carriers with products
    const carriersWithProducts = Array.isArray(data) ? data : (data.carriers || []);

    // Filter by carrier_id if specified
    let filteredCarriers = carriersWithProducts;
    if (params.carrier_id) {
      filteredCarriers = carriersWithProducts.filter((c: any) => c.id === params.carrier_id);
    }

    // Filter by active_only if specified
    if (params.active_only !== false) {
      filteredCarriers = filteredCarriers.filter((c: any) => c.isActive);
    }

    // Extract carriers (without products for cleaner data)
    const carriers = filteredCarriers.map((c: any) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      isActive: c.isActive
    }));

    // Flatten products from all carriers
    const products: any[] = [];
    const productsByCarrier: Record<string, any[]> = {};

    for (const carrier of filteredCarriers) {
      const carrierProducts = carrier.products || [];
      productsByCarrier[carrier.id] = carrierProducts;

      for (const product of carrierProducts) {
        if (params.active_only !== false && !product.isActive) continue;
        products.push({
          ...product,
          carrier: { id: carrier.id, name: carrier.name, displayName: carrier.displayName }
        });
      }
    }

    return {
      carriers: carriers,
      products: products,
      productsByCarrier: productsByCarrier,
      summary: {
        totalCarriers: carriers.length,
        totalProducts: products.length
      }
    };
  } catch (error) {
    console.error('Get carriers and products error:', error);
    return { error: 'Failed to get carriers and products' };
  }
}

// Get agency summary
export async function getAgencySummary(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    // Get date range based on time period
    let startDate: string | null = null;
    const now = new Date();

    switch (params.time_period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
      default:
        startDate = null;
    }

    // Fetch data from Django APIs in parallel
    const [agencyData, dashboardData, agentsData, dealsData] = await Promise.all([
      // Get agency settings
      fetchDjangoApi<any>(`/api/agencies/${agencyId}/settings`, accessToken).catch(() => null),

      // Get dashboard summary for production metrics
      fetchDjangoApi<any>('/api/dashboard/summary/', accessToken).catch(() => null),

      // Get top agents
      fetchDjangoApi<any>('/api/agents/', accessToken, {
        params: { limit: 100 }
      }).catch(() => ({ agents: [] })),

      // Get recent deals
      fetchDjangoApi<any>('/api/deals/', accessToken, {
        params: {
          limit: 100,
          ...(startDate ? { start_date: startDate } : {})
        }
      }).catch(() => ({ deals: [] }))
    ]);

    // Extract agents
    const agents = Array.isArray(agentsData) ? agentsData : (agentsData.agents || agentsData.results || []);
    const activeAgents = agents.filter((a: any) => a.isActive && a.role !== 'client');

    // Extract deals
    const deals = Array.isArray(dealsData) ? dealsData : (dealsData.deals || dealsData.results || []);

    // Calculate metrics
    const totalProduction = deals.reduce((sum: number, deal: any) => sum + (Number(deal.annualPremium) || 0), 0);
    const totalPolicies = deals.length;
    const activePolicies = deals.filter((d: any) => d.statusStandardized === 'active').length;

    // Get top agents by production
    const topAgents = activeAgents
      .sort((a: any, b: any) => (Number(b.totalProd) || 0) - (Number(a.totalProd) || 0))
      .slice(0, 5)
      .map((a: any) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        totalProd: a.totalProd,
        totalPoliciesSold: a.totalPoliciesSold
      }));

    // Get recent deals
    const recentDeals = deals
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      agency: {
        name: agencyData?.name,
        displayName: agencyData?.displayName,
        code: agencyData?.code,
        isActive: agencyData?.isActive
      },
      metrics: {
        totalProduction: totalProduction,
        totalPolicies: totalPolicies,
        activePolicies: activePolicies,
        agentCount: activeAgents.length,
        timePeriod: params.time_period || 'all'
      },
      topAgents: topAgents,
      recentActivity: recentDeals,
      note: 'Recent activity limited to 5 most recent deals'
    };
  } catch (error) {
    console.error('Get agency summary error:', error);
    return { error: 'Failed to get agency summary' };
  }
}

// Get comprehensive analytics using the same RPC as the analytics dashboard page
export async function getPersistencyAnalytics(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    // Call Django API for analytics data
    // This provides comprehensive analytics data including:
    // - Time series by month and carrier
    // - Breakdowns by status, state, age band
    // - Multiple time windows (3m, 6m, 9m, all_time)
    // - Persistency, submitted, and active policy counts
    const data = await fetchDjangoApi<any>('/api/analytics/deals', accessToken, {
      params: { agency_id: agencyId }
    });

    if (!data || !data.meta || !data.series || data.series.length === 0) {
      return {
        message: 'No analytics data available. Please upload policy reports first.',
        meta: null,
        series: [],
        totals: null,
        windowsByCarrier: null,
        breakdownsOverTime: null
      };
    }

    // Return the full analytics object with all breakdowns
    // This matches the structure used by the analytics dashboard
    return data;
  } catch (error) {
    console.error('Error in getPersistencyAnalytics:', error);
    return { error: 'Failed to get analytics data' };
  }
}

// Fuzzy search for agents
export async function searchAgents(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const query = params.query || '';
    const limit = params.limit || 20;

    if (!query || query.trim().length < 2) {
      return { error: 'Search query must be at least 2 characters long' };
    }

    // Call Django fuzzy search API
    const data = await fetchDjangoApi<any>('/api/search-agents/fuzzy', accessToken, {
      params: {
        q: query.trim(),
        limit,
        threshold: params.threshold || 0.3
      }
    });

    // Handle response - Django returns array directly or wrapped
    const agents = Array.isArray(data) ? data : (data.agents || data.results || []);

    return {
      agents: agents.slice(0, limit),
      count: agents.length,
      query: query
    };
  } catch (error) {
    console.error('Search agents error:', error);
    return { error: 'Failed to search agents' };
  }
}

// Fuzzy search for clients
export async function searchClients(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const query = params.query || '';
    const limit = params.limit || 20;

    if (!query || query.trim().length < 2) {
      return { error: 'Search query must be at least 2 characters long' };
    }

    // Call Django fuzzy search API
    const data = await fetchDjangoApi<any>('/api/search-clients/fuzzy', accessToken, {
      params: {
        q: query.trim(),
        limit,
        threshold: params.threshold || 0.3
      }
    });

    // Handle response
    const clients = Array.isArray(data) ? data : (data.clients || data.results || []);

    return {
      clients: clients.slice(0, limit),
      count: clients.length,
      query: query
    };
  } catch (error) {
    console.error('Search clients error:', error);
    return { error: 'Failed to search clients' };
  }
}

// Fuzzy search for policies/deals
export async function searchPolicies(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const query = params.query || '';
    const limit = params.limit || 20;

    if (!query || query.trim().length < 2) {
      return { error: 'Search query must be at least 2 characters long' };
    }

    // Call Django fuzzy search API
    const data = await fetchDjangoApi<any>('/api/search-policies', accessToken, {
      params: {
        q: query.trim(),
        limit,
        threshold: params.threshold || 0.3
      }
    });

    // Handle response
    const policies = Array.isArray(data) ? data : (data.policies || data.results || []);

    return {
      policies: policies.slice(0, limit),
      count: policies.length,
      query: query
    };
  } catch (error) {
    console.error('Search policies error:', error);
    return { error: 'Failed to search policies' };
  }
}

// Get agent hierarchy with production metrics
export async function getAgentHierarchy(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const agentId = params.agent_id;

    if (!agentId) {
      return { error: 'Agent ID is required' };
    }

    // Get root agent and downline from Django API
    const [agentData, downlineData] = await Promise.all([
      fetchDjangoApi<any>(`/api/agents/${agentId}`, accessToken).catch(() => null),
      fetchDjangoApi<any>(`/api/agents/${agentId}/downline`, accessToken).catch(() => ({ downlines: [] }))
    ]);

    if (!agentData) {
      return { error: 'Agent not found' };
    }

    const rootAgent = {
      id: agentData.id,
      firstName: agentData.firstName,
      lastName: agentData.lastName,
      email: agentData.email,
      totalProd: agentData.totalProd,
      totalPoliciesSold: agentData.totalPoliciesSold,
      uplineId: agentData.uplineId,
      status: agentData.status
    };

    const downlines = downlineData.downlines || [];

    // Combine root agent with downlines
    const allAgents = [rootAgent, ...downlines.map((d: any) => ({
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      totalProd: d.totalProd || 0,
      totalPoliciesSold: d.totalPoliciesSold || 0,
      uplineId: d.uplineId,
      status: d.status
    }))];

    // Calculate aggregate metrics
    const totalProduction = allAgents.reduce((sum, agent) => sum + (Number(agent.totalProd) || 0), 0);
    const totalPolicies = allAgents.reduce((sum, agent) => sum + (Number(agent.totalPoliciesSold) || 0), 0);
    const activeAgents = allAgents.filter(a => a.status === 'active').length;

    return {
      rootAgent: rootAgent,
      hierarchy: {
        totalAgents: allAgents.length,
        totalProduction: totalProduction,
        totalPolicies: totalPolicies,
        activeAgents: activeAgents,
        averageProduction: allAgents.length > 0 ? totalProduction / allAgents.length : 0
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
export async function compareHierarchies(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const agentIds = params.agent_ids || [];

    if (!agentIds || agentIds.length === 0) {
      return { error: 'At least one agent ID is required' };
    }

    const comparisons = await Promise.all(
      agentIds.map(async (agentId: string) => {
        const hierarchy = await getAgentHierarchy({ agent_id: agentId }, agencyId, accessToken);
        if (hierarchy.error) {
          return { agentId: agentId, error: hierarchy.error };
        }

        return {
          agentId: agentId,
          rootAgent: hierarchy.rootAgent,
          metrics: hierarchy.hierarchy
        };
      })
    );

    // Calculate comparison metrics
    const totalProduction = comparisons.reduce((sum, comp) =>
      sum + (comp.metrics?.totalProduction || 0), 0);
    const totalPolicies = comparisons.reduce((sum, comp) =>
      sum + (comp.metrics?.totalPolicies || 0), 0);
    const totalAgents = comparisons.reduce((sum, comp) =>
      sum + (comp.metrics?.totalAgents || 0), 0);

    // Find best performing hierarchy
    const bestProduction = comparisons.reduce((best, comp) =>
      (comp.metrics?.totalProduction || 0) > (best.metrics?.totalProduction || 0) ? comp : best,
      comparisons[0] || { metrics: { totalProduction: 0 } });

    return {
      comparisons: comparisons,
      summary: {
        totalHierarchies: comparisons.length,
        totalProduction: totalProduction,
        totalPolicies: totalPolicies,
        totalAgents: totalAgents,
        averageProductionPerHierarchy: comparisons.length > 0 ? totalProduction / comparisons.length : 0
      },
      bestPerforming: bestProduction,
      note: 'Compare hierarchies by totalProduction, totalPolicies, or totalAgents'
    };
  } catch (error) {
    console.error('Compare hierarchies error:', error);
    return { error: 'Failed to compare hierarchies' };
  }
}

// Get deals with cursor pagination
export async function getDealsPaginated(params: any, agencyId: string, cursor?: { cursor_created_at: string; cursor_id: string }, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const limit = Math.min(params.limit || 50, 200);

    // Build query params for Django API
    const queryParams: Record<string, any> = {
      limit,
    };

    // Apply filters
    if (params.status && params.status !== 'all') {
      queryParams.status = params.status;
    }
    if (params.agent_id) {
      queryParams.agent_id = params.agent_id;
    }
    if (params.carrier_id) {
      queryParams.carrier_id = params.carrier_id;
    }
    if (params.start_date) {
      queryParams.start_date = params.start_date;
    }
    if (params.end_date) {
      queryParams.end_date = params.end_date;
    }

    // Apply cursor pagination
    if (cursor?.cursor_created_at && cursor?.cursor_id) {
      queryParams.cursor_created_at = cursor.cursor_created_at;
      queryParams.cursor_id = cursor.cursor_id;
    }

    const data = await fetchDjangoApi<any>('/api/deals/', accessToken, { params: queryParams });

    // Handle response structure
    const deals = Array.isArray(data) ? data : (data.deals || data.results || []);

    // Calculate aggregates for this page
    const totalPremium = deals.reduce((sum: number, deal: any) => sum + (Number(deal.annualPremium) || 0), 0);
    const statusCounts = deals.reduce((acc: any, deal: any) => {
      const status = deal.statusStandardized || deal.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Provide next cursor
    const last = deals.length > 0 ? deals[deals.length - 1] : null;
    const nextCursor = last ? { cursorCreatedAt: last.createdAt, cursorId: last.id } : null;

    return {
      deals: deals,
      count: deals.length,
      hasMore: deals.length === limit,
      nextCursor: nextCursor,
      pageSummary: {
        totalPremium: totalPremium,
        statusBreakdown: statusCounts
      }
    };
  } catch (error) {
    console.error('Get deals paginated error:', error);
    return { error: 'Failed to get paginated deals' };
  }
}

// Get agents with cursor pagination
export async function getAgentsPaginated(params: any, agencyId: string, cursor?: { cursor_id: string }, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const limit = Math.min(params.limit || 50, 200);

    // Build query params for Django API
    const queryParams: Record<string, any> = {
      limit,
    };

    // Apply filters
    if (params.agent_id) {
      queryParams.agent_id = params.agent_id;
    }
    if (params.status) {
      queryParams.status = params.status;
    }

    // Apply cursor pagination
    if (cursor?.cursor_id) {
      queryParams.cursor_id = cursor.cursor_id;
    }

    const data = await fetchDjangoApi<any>('/api/agents/', accessToken, { params: queryParams });

    // Handle response structure
    const agents = Array.isArray(data) ? data : (data.agents || data.results || []);

    // Calculate aggregates for this page
    const totalProduction = agents.reduce((sum: number, agent: any) => sum + (Number(agent.totalProd) || 0), 0);
    const totalPolicies = agents.reduce((sum: number, agent: any) => sum + (Number(agent.totalPoliciesSold) || 0), 0);
    const activeAgents = agents.filter((a: any) => a.isActive).length;

    // Provide next cursor
    const last = agents.length > 0 ? agents[agents.length - 1] : null;
    const nextCursor = last ? { cursorId: last.id } : null;

    return {
      agents: agents,
      count: agents.length,
      hasMore: agents.length === limit,
      nextCursor: nextCursor,
      pageSummary: {
        totalProduction: totalProduction,
        totalPolicies: totalPolicies,
        activeAgents: activeAgents,
        averageProduction: agents.length > 0 ? totalProduction / agents.length : 0
      }
    };
  } catch (error) {
    console.error('Get agents paginated error:', error);
    return { error: 'Failed to get paginated agents' };
  }
}

// Smart data summarization based on query intent
export async function getDataSummary(params: any, agencyId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return { error: 'Authentication required' };
    }

    const dataType = params.data_type || 'deals'; // 'deals', 'agents', 'clients'

    if (dataType === 'deals') {
      // Build query params for Django API
      const queryParams: Record<string, any> = {
        limit: 1000, // Get sample for summary
      };

      if (params.status && params.status !== 'all') {
        queryParams.status = params.status;
      }
      if (params.agent_id) {
        queryParams.agent_id = params.agent_id;
      }
      if (params.carrier_id) {
        queryParams.carrier_id = params.carrier_id;
      }
      if (params.start_date) {
        queryParams.start_date = params.start_date;
      }
      if (params.end_date) {
        queryParams.end_date = params.end_date;
      }

      const data = await fetchDjangoApi<any>('/api/deals/', accessToken, { params: queryParams });

      const deals = Array.isArray(data) ? data : (data.deals || data.results || []);
      const totalCount = data.total || deals.length;

      const totalPremium = deals.reduce((sum: number, deal: any) => sum + (Number(deal.annualPremium) || 0), 0);
      const statusCounts = deals.reduce((acc: any, deal: any) => {
        const status = deal.statusStandardized || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // If we got a sample, estimate totals
      if (totalCount > deals.length) {
        return {
          dataType: 'deals',
          totalCount: totalCount,
          summaryOnly: true,
          note: `Dataset exceeds ${deals.length} entries. Showing summary based on sample. Use get_deals_paginated for detailed data.`,
          summary: {
            estimatedTotalPremium: totalPremium * (totalCount / deals.length),
            statusBreakdown: statusCounts,
            sampleSize: deals.length
          }
        };
      }

      return {
        dataType: 'deals',
        totalCount: totalCount,
        summaryOnly: false,
        summary: {
          totalPremium: totalPremium,
          averagePremium: totalCount > 0 ? totalPremium / totalCount : 0,
          statusBreakdown: statusCounts
        }
      };
    } else if (dataType === 'agents') {
      const queryParams: Record<string, any> = {
        limit: 1000,
      };

      if (params.agent_id) {
        queryParams.agent_id = params.agent_id;
      }
      if (params.status) {
        queryParams.status = params.status;
      }

      const data = await fetchDjangoApi<any>('/api/agents/', accessToken, { params: queryParams });

      const agents = Array.isArray(data) ? data : (data.agents || data.results || []);
      const totalCount = data.total || agents.length;

      const totalProduction = agents.reduce((sum: number, agent: any) => sum + (Number(agent.totalProd) || 0), 0);
      const totalPolicies = agents.reduce((sum: number, agent: any) => sum + (Number(agent.totalPoliciesSold) || 0), 0);
      const activeAgents = agents.filter((a: any) => a.isActive).length;

      // If we got a sample, estimate totals
      if (totalCount > agents.length) {
        return {
          dataType: 'agents',
          totalCount: totalCount,
          summaryOnly: true,
          note: `Dataset exceeds ${agents.length} entries. Showing summary based on sample. Use get_agents_paginated for detailed data.`,
          summary: {
            estimatedTotalProduction: totalProduction * (totalCount / agents.length),
            estimatedTotalPolicies: totalPolicies * (totalCount / agents.length),
            activeAgents: activeAgents,
            sampleSize: agents.length
          }
        };
      }

      return {
        dataType: 'agents',
        totalCount: totalCount,
        summaryOnly: false,
        summary: {
          totalProduction: totalProduction,
          totalPolicies: totalPolicies,
          activeAgents: activeAgents,
          averageProduction: totalCount > 0 ? totalProduction / totalCount : 0
        }
      };
    }

    return { error: 'Unsupported data type for summary' };
  } catch (error) {
    console.error('Get data summary error:', error);
    return { error: 'Failed to get data summary' };
  }
}

// Main executor function
export async function executeToolCall(toolName: string, input: any, agencyId: string, accessToken?: string) {
  switch (toolName) {
    case 'get_deals':
      return await getDeals(input, agencyId, accessToken);
    case 'get_agents':
      return await getAgents(input, agencyId, accessToken);
    case 'get_persistency_analytics':
      return await getPersistencyAnalytics(input, agencyId, accessToken);
    case 'get_conversations_data':
      return await getConversationsData(input, agencyId, accessToken);
    case 'get_carriers_and_products':
      return await getCarriersAndProducts(input, agencyId, accessToken);
    case 'get_agency_summary':
      return await getAgencySummary(input, agencyId, accessToken);
    case 'search_agents':
      return await searchAgents(input, agencyId, accessToken);
    case 'search_clients':
      return await searchClients(input, agencyId, accessToken);
    case 'search_policies':
      return await searchPolicies(input, agencyId, accessToken);
    case 'get_agent_hierarchy':
      return await getAgentHierarchy(input, agencyId, accessToken);
    case 'compare_hierarchies':
      return await compareHierarchies(input, agencyId, accessToken);
    case 'get_deals_paginated':
      return await getDealsPaginated(input, agencyId, input.cursor, accessToken);
    case 'get_agents_paginated':
      return await getAgentsPaginated(input, agencyId, input.cursor, accessToken);
    case 'get_data_summary':
      return await getDataSummary(input, agencyId, accessToken);
    case 'create_visualization':
      // Return a marker that tells the frontend to create a visualization
      return {
        _visualization: true,
        type: input.type,
        title: input.title,
        description: input.description,
        dataSource: input.data_source,
        config: input.config
      };
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

