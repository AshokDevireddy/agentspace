/**
 * AI Mode Permission System
 *
 * This module enforces data access controls for the AI Mode feature.
 * Users can ONLY access data they would normally have access to through the UI.
 */

import { createServerClient } from '@/lib/supabase/server';

// User context injected into every tool call
export interface UserContext {
  user_id: string;
  agency_id: string;
  is_admin: boolean;
  downline_agent_ids: string[];
}

// Permission scope types
type PermissionScope = 'admin_only' | 'self_and_downline' | 'self_only' | 'agency';

// Tool permission configuration
interface ToolPermission {
  admin_required?: boolean;
  scope: PermissionScope;
  description: string;
}

// Permission matrix for all tools
export const TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  // Admin-only tools
  get_agency_summary: {
    admin_required: true,
    scope: 'admin_only',
    description: 'Agency-wide summary statistics'
  },
  get_processing_status: {
    admin_required: true,
    scope: 'admin_only',
    description: 'NIPR and ingestion job status'
  },

  // Self + downline scoped tools
  get_deals: {
    scope: 'self_and_downline',
    description: 'Deal/policy data filtered to user and downline'
  },
  get_agents: {
    scope: 'self_and_downline',
    description: 'Agent data filtered to user and downline'
  },
  get_persistency_analytics: {
    scope: 'self_and_downline',
    description: 'Analytics data filtered to user and downline'
  },
  get_expected_payouts: {
    scope: 'self_and_downline',
    description: 'Expected payout calculations for user and downline'
  },
  get_downline_payouts: {
    scope: 'self_and_downline',
    description: 'Expected payouts for each agent in user hierarchy'
  },
  get_agent_debt: {
    scope: 'self_and_downline',
    description: 'Agent debt calculations for user and downline'
  },
  get_scoreboard: {
    scope: 'self_and_downline',
    description: 'Scoreboard data filtered to user and downline'
  },
  get_leaderboard: {
    scope: 'self_and_downline',
    description: 'Leaderboard data filtered to user and downline'
  },
  get_clients: {
    scope: 'self_and_downline',
    description: 'Client list filtered to user and downline agents'
  },
  get_positions: {
    scope: 'agency',
    description: 'Agency position hierarchy (safe reference data)'
  },
  get_at_risk_policies: {
    scope: 'self_and_downline',
    description: 'At-risk policies for user and downline'
  },
  get_agent_hierarchy: {
    scope: 'self_and_downline',
    description: 'Hierarchy data for user and downline only'
  },
  compare_hierarchies: {
    scope: 'self_and_downline',
    description: 'Hierarchy comparison limited to accessible agents'
  },
  get_deals_paginated: {
    scope: 'self_and_downline',
    description: 'Paginated deals for user and downline'
  },
  get_agents_paginated: {
    scope: 'self_and_downline',
    description: 'Paginated agents for user and downline'
  },
  get_data_summary: {
    scope: 'self_and_downline',
    description: 'Data summary for user and downline'
  },
  search_agents: {
    scope: 'self_and_downline',
    description: 'Search agents in downline only for non-admins'
  },
  search_policies: {
    scope: 'self_and_downline',
    description: 'Search policies for user and downline'
  },

  // Self-only tools
  get_conversations_data: {
    scope: 'self_only',
    description: 'SMS conversations for user only (admins see all)'
  },
  get_conversations: {
    scope: 'self_only',
    description: 'Conversation history for user only'
  },
  get_draft_messages: {
    scope: 'self_only',
    description: 'Draft messages for user only'
  },

  // Agency-wide tools (safe for all users)
  get_carriers_and_products: {
    scope: 'agency',
    description: 'Carrier and product information (agency-wide)'
  },
  search_clients: {
    scope: 'self_and_downline',
    description: 'Search clients owned by user and downline'
  },
  get_client_details: {
    scope: 'self_and_downline',
    description: 'Client details for owned clients only'
  },
  get_client_policies: {
    scope: 'self_and_downline',
    description: 'Client policies for owned clients only'
  },
  get_policy_details: {
    scope: 'self_and_downline',
    description: 'Policy details for owned policies only'
  },
  get_commission_structure: {
    scope: 'agency',
    description: 'Commission structure information'
  },

  // Visualization tools (no direct data access - uses already-retrieved data)
  create_visualization: {
    scope: 'agency',
    description: 'Create charts from already-retrieved data (no new data access)'
  },

  // New tools added for feature parity with dashboard
  get_carrier_resources: {
    scope: 'agency',
    description: 'Carrier contact info and resources (agency-wide reference data)'
  },
  get_user_profile: {
    scope: 'self_only',
    description: 'User profile and subscription info (own data only)'
  },
  get_lead_source_analytics: {
    scope: 'self_and_downline',
    description: 'Lead source analytics for user and downline'
  },
  get_production_trends: {
    scope: 'self_and_downline',
    description: 'Production trend data for user and downline'
  },
  get_carrier_distribution: {
    scope: 'self_and_downline',
    description: 'Carrier distribution for user and downline'
  },
  get_analytics_snapshot: {
    scope: 'self_and_downline',
    description: 'Analytics snapshot for user and downline'
  },
};

// Result of permission check
export interface PermissionResult {
  allowed: boolean;
  filteredInput: any;
  error?: string;
  scope?: PermissionScope;
}

/**
 * Pre-fetch user's downline agent IDs at session start
 * This is cached and reused for all tool calls in a session
 */
export async function getDownlineAgentIds(userId: string, agencyId: string): Promise<string[]> {
  try {
    const supabase = await createServerClient();

    // Use the get_agent_downline RPC function
    const { data, error } = await supabase.rpc('get_agent_downline', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error fetching downline:', error);
      return [];
    }

    return data?.map((a: any) => a.id) || [];
  } catch (error) {
    console.error('Error in getDownlineAgentIds:', error);
    return [];
  }
}

/**
 * Build user context for a session
 * Called once at the start of a chat session
 */
export async function buildUserContext(
  userId: string,
  agencyId: string,
  isAdmin: boolean
): Promise<UserContext> {
  // For admins, we don't need to fetch downline (they have full access)
  // For non-admins, fetch their downline
  const downlineAgentIds = isAdmin ? [] : await getDownlineAgentIds(userId, agencyId);

  return {
    user_id: userId,
    agency_id: agencyId,
    is_admin: isAdmin,
    downline_agent_ids: downlineAgentIds,
  };
}

/**
 * Check if a user has permission to access a specific agent's data
 */
export function canAccessAgent(agentId: string, context: UserContext): boolean {
  // Admins can access any agent
  if (context.is_admin) return true;

  // User can access their own data
  if (agentId === context.user_id) return true;

  // User can access their downline's data
  return context.downline_agent_ids.includes(agentId);
}

/**
 * Get list of all agent IDs the user is allowed to access
 */
export function getAllowedAgentIds(context: UserContext): string[] {
  if (context.is_admin) {
    // Admins don't need filtering (handled at query level)
    return [];
  }
  return [context.user_id, ...context.downline_agent_ids];
}

/**
 * Enforce permissions for a tool call
 * Returns filtered input with scope constraints applied
 */
export function enforcePermissions(
  toolName: string,
  input: any,
  context: UserContext
): PermissionResult {
  const permission = TOOL_PERMISSIONS[toolName];

  // Unknown tool - allow with warning
  if (!permission) {
    console.warn(`No permission config for tool: ${toolName}`);
    return { allowed: true, filteredInput: input };
  }

  // Admin-only check
  if (permission.admin_required && !context.is_admin) {
    return {
      allowed: false,
      filteredInput: null,
      error: `This information is only available to administrators. I can only show you data for yourself and your team.`,
      scope: permission.scope,
    };
  }

  // For admins, no filtering needed
  if (context.is_admin) {
    return {
      allowed: true,
      filteredInput: input,
      scope: permission.scope,
    };
  }

  // Non-admin scope enforcement
  switch (permission.scope) {
    case 'self_and_downline': {
      // If a specific agent_id is requested, verify access
      if (input.agent_id && input.agent_id !== context.user_id) {
        if (!context.downline_agent_ids.includes(input.agent_id)) {
          return {
            allowed: false,
            filteredInput: null,
            error: `You don't have permission to view data for this agent. You can only access data for yourself and agents in your downline.`,
            scope: permission.scope,
          };
        }
      }

      // For compare_hierarchies, verify all agent_ids
      if (input.agent_ids && Array.isArray(input.agent_ids)) {
        const allowedIds = getAllowedAgentIds(context);
        const unauthorizedIds = input.agent_ids.filter(
          (id: string) => !allowedIds.includes(id)
        );
        if (unauthorizedIds.length > 0) {
          return {
            allowed: false,
            filteredInput: null,
            error: `You don't have permission to compare some of these hierarchies. You can only access agents in your downline.`,
            scope: permission.scope,
          };
        }
      }

      // Auto-inject scope limitation for queries
      return {
        allowed: true,
        filteredInput: {
          ...input,
          __allowed_agent_ids: getAllowedAgentIds(context),
          __scope_enforced: true,
        },
        scope: permission.scope,
      };
    }

    case 'self_only': {
      // Force agent_id to be the current user
      return {
        allowed: true,
        filteredInput: {
          ...input,
          agent_id: context.user_id,
          __allowed_agent_ids: [context.user_id],
          __scope_enforced: true,
        },
        scope: permission.scope,
      };
    }

    case 'agency': {
      // No additional filtering needed, agency_id is always enforced
      return {
        allowed: true,
        filteredInput: input,
        scope: permission.scope,
      };
    }

    default:
      return { allowed: true, filteredInput: input };
  }
}

/**
 * Get tools available to a user based on their role
 * Used to filter the tools list sent to the LLM
 */
export function getAvailableToolsForUser(isAdmin: boolean): string[] {
  const availableTools: string[] = [];

  for (const [toolName, permission] of Object.entries(TOOL_PERMISSIONS)) {
    if (permission.admin_required && !isAdmin) {
      continue;
    }
    availableTools.push(toolName);
  }

  return availableTools;
}

/**
 * Check if a tool is available to a user
 */
export function isToolAvailable(toolName: string, isAdmin: boolean): boolean {
  const permission = TOOL_PERMISSIONS[toolName];
  if (!permission) return true; // Unknown tools are allowed
  if (permission.admin_required && !isAdmin) return false;
  return true;
}

/**
 * Get user-friendly description of user's data access scope
 */
export function getAccessScopeDescription(context: UserContext): string {
  if (context.is_admin) {
    return 'You have administrator access and can view all agency data.';
  }

  const downlineCount = context.downline_agent_ids.length;
  if (downlineCount === 0) {
    return 'You can view your own data only.';
  }

  return `You can view your own data and data for ${downlineCount} agent${downlineCount === 1 ? '' : 's'} in your downline.`;
}
