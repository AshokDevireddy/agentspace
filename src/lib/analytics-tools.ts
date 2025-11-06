"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Get the logged-in user's ID and details
 */
export async function getLoggedInUserId() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, auth_user_id, agency_id, email, role")
      .eq("auth_user_id", auth.user.id)
      .single()

    if (userError || !userRow?.id) {
      return { error: "User not found" }
    }

    return {
      data: {
        user_id: userRow.id,
        auth_user_id: userRow.auth_user_id,
        agency_id: userRow.agency_id,
        email: userRow.email,
        role: userRow.role
      },
      success: true
    }
  } catch (error) {
    return { error: "Failed to get user information" }
  }
}

/**
 * Get analytics data for the logged-in agent
 */
export async function getAgentAnalytics() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth?.user?.id

    if (!userId) {
      return { error: "No user ID provided or found" }
    }

    // Get user row
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, agency_id")
      .eq("auth_user_id", userId)
      .single()

    if (userError || !userRow?.id) {
      return { error: "User not found" }
    }

    // Get analytics data
    const { data: rpcData, error: rpcError } = await supabase
      .rpc("get_analytics_from_deals_for_agent", { p_user_id: userRow.id })

    if (rpcError) {
      return { error: rpcError.message }
    }

    return { data: rpcData, success: true }
  } catch (error) {
    return { error: "Failed to fetch analytics data" }
  }
}

/**
 * Get top 5 performing carriers by submission count
 */
export async function getTopCarriers() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, agency_id")
      .eq("auth_user_id", auth.user.id)
      .single()

    if (!userRow?.id) {
      return { error: "User not found" }
    }

    const { data: rpcData } = await supabase
      .rpc("get_analytics_from_deals_for_agent", { p_user_id: userRow.id })

    if (!rpcData || typeof rpcData !== 'object' || !('series' in rpcData)) {
      return { error: "Invalid analytics data" }
    }

    // Aggregate by carrier
    const carrierStats: Record<string, number> = {}
    const series = rpcData.series as Array<{
      carrier: string
      submitted: number
    }>

    series.forEach((item: { carrier: string; submitted: number }) => {
      if (!carrierStats[item.carrier]) {
        carrierStats[item.carrier] = 0
      }
      carrierStats[item.carrier] += item.submitted
    })

    // Sort and get top 5 carriers
    const topCarriers = Object.entries(carrierStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([carrier, submissions]) => ({ carrier, submissions }))

    return { data: topCarriers, success: true }
  } catch (error) {
    return { error: "Failed to fetch top carriers" }
  }
}

/**
 * Calculate average persistency rate across all carriers
 */
export async function getAveragePersistency() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, agency_id")
      .eq("auth_user_id", auth.user.id)
      .single()

    if (!userRow?.id) {
      return { error: "User not found" }
    }

    const { data: rpcData } = await supabase
      .rpc("get_analytics_from_deals_for_agent", { p_user_id: userRow.id })

    if (!rpcData || typeof rpcData !== 'object' || !('series' in rpcData)) {
      return { error: "Invalid analytics data" }
    }

    const series = rpcData.series as Array<{
      carrier: string
      persistency: number
    }>

    if (series.length === 0) {
      return { error: "No data found" }
    }

    const avgPersistency = series.reduce(
      (sum: number, item: { persistency: number }) => sum + item.persistency,
      0
    ) / series.length

    return {
      data: {
        average_persistency: avgPersistency.toFixed(4),
        data_points: series.length
      },
      success: true
    }
  } catch (error) {
    return { error: "Failed to calculate persistency" }
  }
}

/**
 * Get submission trends over the last 6 months
 */
export async function getSubmissionTrends() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, agency_id")
      .eq("auth_user_id", auth.user.id)
      .single()

    if (!userRow?.id) {
      return { error: "User not found" }
    }

    const { data: rpcData } = await supabase
      .rpc("get_analytics_from_deals_for_agent", { p_user_id: userRow.id })

    if (!rpcData || typeof rpcData !== 'object' || !('series' in rpcData)) {
      return { error: "Invalid analytics data" }
    }

    const series = rpcData.series as Array<{
      period: string
      carrier: string
      submitted: number
    }>

    // Get unique periods and sort them - take last 6 months
    const periods = Array.from(new Set(series.map((item: { period: string }) => item.period)))
      .sort()
      .slice(-6)

    // Aggregate submissions by period
    const trendData = periods.map(period => {
      const periodData = series.filter((item: { period: string }) => item.period === period)
      const totalSubmissions = periodData.reduce(
        (sum: number, item: { submitted: number }) => sum + item.submitted,
        0
      )
      return { period, submissions: totalSubmissions }
    })

    return { data: trendData, success: true }
  } catch (error) {
    return { error: "Failed to fetch submission trends" }
  }
}

/**
 * Get current month's performance summary
 */
export async function getCurrentMonthSummary() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, agency_id")
      .eq("auth_user_id", auth.user.id)
      .single()

    if (!userRow?.id) {
      return { error: "User not found" }
    }

    const { data: rpcData } = await supabase
      .rpc("get_analytics_from_deals_for_agent", { p_user_id: userRow.id })

    if (!rpcData || typeof rpcData !== 'object' || !('series' in rpcData)) {
      return { error: "Invalid analytics data" }
    }

    const series = rpcData.series as Array<{
      period: string
      active: number
      inactive: number
      submitted: number
      avg_premium_submitted: number
    }>

    // Get the most recent period
    const latestPeriod = series.reduce((latest: string, item: { period: string }) => {
      return item.period > latest ? item.period : latest
    }, series[0]?.period || "")

    const currentMonthData = series.filter((item: { period: string }) => item.period === latestPeriod)

    const summary = {
      period: latestPeriod,
      total_active: currentMonthData.reduce((sum: number, item: { active: number }) => sum + item.active, 0),
      total_inactive: currentMonthData.reduce((sum: number, item: { inactive: number }) => sum + item.inactive, 0),
      total_submitted: currentMonthData.reduce((sum: number, item: { submitted: number }) => sum + item.submitted, 0),
      avg_premium: (currentMonthData.reduce((sum: number, item: { avg_premium_submitted: number }) =>
        sum + item.avg_premium_submitted, 0) / currentMonthData.length).toFixed(2)
    }

    return { data: summary, success: true }
  } catch (error) {
    return { error: "Failed to fetch current month summary" }
  }
}

/**
 * Post a new deal/policy (requires explicit user confirmation)
 *
 * @param dealData - Object containing all deal information:
 *   - carrier_id: ID of the carrier
 *   - product_id: ID of the product
 *   - policy_effective_date: Date when policy becomes effective (YYYY-MM-DD)
 *   - monthly_premium: Monthly premium amount
 *   - policy_number: Policy number (optional if application_number provided)
 *   - application_number: Application number (optional if policy_number provided)
 *   - billing_cycle: Billing cycle (monthly, quarterly, semi-annually, annually)
 *   - lead_source: Source of the lead
 *   - client_name: Full name of the client
 *   - client_email: Client's email address
 *   - client_phone: Client's phone number
 *   - client_date_of_birth: Client's date of birth (YYYY-MM-DD)
 *   - client_ssn_last_4: Last 4 digits of client's SSN
 *   - client_address: Client's full address
 */
export async function postDeal(dealData: {
  carrier_id: string
  product_id: string
  policy_effective_date: string
  monthly_premium: number
  policy_number?: string
  application_number?: string
  billing_cycle: string
  lead_source: string
  client_name: string
  client_email: string
  client_phone: string
  client_date_of_birth: string
  client_ssn_last_4: string
  client_address: string
}) {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    // Get user's agent_id and agency_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, agency_id')
      .eq('auth_user_id', auth.user.id)
      .single()

    if (userError || !userData?.id || !userData?.agency_id) {
      return { error: "Failed to get user information" }
    }

    const agent_id = userData.id
    const agency_id = userData.agency_id

    // Validate required fields
    if (!dealData.carrier_id || !dealData.product_id || !dealData.policy_effective_date ||
        !dealData.monthly_premium || !dealData.billing_cycle || !dealData.lead_source ||
        !dealData.client_name || !dealData.client_email || !dealData.client_phone ||
        !dealData.client_date_of_birth || !dealData.client_ssn_last_4 || !dealData.client_address) {
      return { error: "Missing required fields" }
    }

    // At least one of policy_number or application_number must be provided
    if (!dealData.policy_number && !dealData.application_number) {
      return { error: "Either policy_number or application_number must be provided" }
    }

    // Handle client invitation
    let client_id = null
    let invitationMessage = ''

    try {
      // Check if client already exists
      const { data: existingClient } = await supabase
        .from('users')
        .select('id, auth_user_id, status')
        .eq('email', dealData.client_email)
        .eq('role', 'client')
        .maybeSingle()

      if (existingClient) {
        client_id = existingClient.id
        invitationMessage = existingClient.status === 'pending'
          ? 'Client invitation was previously sent.'
          : 'Client already has an account.'
      } else {
        // Send invitation to client
        const inviteResponse = await fetch('/api/clients/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: dealData.client_email,
            firstName: dealData.client_name.split(' ')[0] || dealData.client_name,
            lastName: dealData.client_name.split(' ').slice(1).join(' ') || 'Client',
            phoneNumber: dealData.client_phone
          })
        })

        const inviteDataResponse = await inviteResponse.json()

        if (inviteResponse.ok && inviteDataResponse.success) {
          client_id = inviteDataResponse.userId
          invitationMessage = inviteDataResponse.alreadyExists
            ? 'Client invitation was previously sent.'
            : 'Invitation email sent to client successfully!'
        } else {
          invitationMessage = `Warning: Failed to send invitation email. Deal will still be created.`
        }
      }
    } catch (clientError) {
      invitationMessage = `Warning: Error sending invitation. Deal will still be created.`
    }

    // Construct payload
    const payload = {
      agent_id,
      carrier_id: dealData.carrier_id,
      product_id: dealData.product_id,
      client_id,
      agency_id,
      client_name: dealData.client_name,
      client_email: dealData.client_email,
      client_phone: dealData.client_phone,
      date_of_birth: dealData.client_date_of_birth,
      ssn_last_4: dealData.client_ssn_last_4,
      client_address: dealData.client_address,
      policy_number: dealData.policy_number || null,
      application_number: dealData.application_number || null,
      monthly_premium: dealData.monthly_premium,
      annual_premium: dealData.monthly_premium * 12,
      policy_effective_date: dealData.policy_effective_date,
      billing_cycle: dealData.billing_cycle,
      lead_source: dealData.lead_source,
    }

    // Submit deal to API
    const response = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const responseData = await response.json()

    if (!response.ok) {
      return { error: responseData.error || "Failed to submit deal" }
    }

    // Build success message
    let successMessage = responseData.operation === 'updated'
      ? "Deal updated successfully! This policy already existed and has been updated."
      : "Deal created successfully!"

    if (invitationMessage) {
      successMessage += ' ' + invitationMessage
    }

    return {
      data: {
        deal_id: responseData.id,
        operation: responseData.operation,
        message: successMessage,
        invitation_status: invitationMessage
      },
      success: true
    }
  } catch (error) {
    return { error: "Failed to post deal: " + (error instanceof Error ? error.message : "Unknown error") }
  }
}

/**
 * Get list of agents with optional filtering
 */
export async function getAgentsList() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    const response = await fetch('/api/agents?view=list&limit=100')

    if (!response.ok) {
      return { error: "Failed to fetch agents" }
    }

    const data = await response.json()

    return {
      data: {
        agents: data.agents,
        total_count: data.pagination?.totalCount || data.agents.length
      },
      success: true
    }
  } catch (error) {
    return { error: "Failed to fetch agents list" }
  }
}

/**
 * Add a new user/agent (requires explicit user confirmation)
 *
 * @param userData - Object containing user information:
 *   - email: User's email address
 *   - first_name: User's first name
 *   - last_name: User's last name
 *   - role: User role (agent, admin, client)
 *   - phone_number: User's phone number (optional)
 *   - upline_name: Name of the upline agent (optional)
 */
export async function addUser(userData: {
  email: string
  first_name: string
  last_name: string
  role: string
  phone_number?: string
  upline_name?: string
}) {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    // Validate required fields
    if (!userData.email || !userData.first_name || !userData.last_name || !userData.role) {
      return { error: "Missing required fields: email, first_name, last_name, and role are required" }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userData.email)) {
      return { error: "Invalid email format" }
    }

    // Send invitation to new user
    const response = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role: userData.role,
        phoneNumber: userData.phone_number || null,
        uplineName: userData.upline_name || null
      })
    })

    const responseData = await response.json()

    if (!response.ok) {
      return { error: responseData.error || "Failed to add user" }
    }

    return {
      data: {
        user_id: responseData.userId,
        message: `User ${userData.first_name} ${userData.last_name} added successfully! Invitation email sent to ${userData.email}.`
      },
      success: true
    }
  } catch (error) {
    return { error: "Failed to add user: " + (error instanceof Error ? error.message : "Unknown error") }
  }
}

/**
 * Navigate to a specific page in the application
 *
 * @param pagePath - The path to navigate to. Available pages:
 *   - "/dashboard" - Dashboard page
 *   - "/analytics" - Analytics page
 *   - "/policies/book" - Policies book page
 *   - "/policies/post" - Post a new deal page
 *   - "/agents" - Agents page
 *   - "/clients" - Clients page
 *   - "/commissions" - Commissions page
 *   - "/settings" - Settings page
 */
export async function navigateToPage(pagePath: string) {
  try {
    // Validate the page path
    const validPaths = [
      "/dashboard",
      "/analytics",
      "/policies/book",
      "/policies/post",
      "/agents",
      "/clients",
      "/commissions",
      "/settings"
    ]

    if (!validPaths.includes(pagePath)) {
      return {
        error: `Invalid page path. Valid paths are: ${validPaths.join(", ")}`
      }
    }

    // Use Next.js client-side navigation via custom event
    if (typeof window !== 'undefined') {
      // Dispatch custom event that will be caught by the layout
      const navigationEvent = new CustomEvent('arcten-navigate', {
        detail: { path: pagePath }
      })
      window.dispatchEvent(navigationEvent)

      return {
        data: { message: `Navigating to ${pagePath}...` },
        success: true
      }
    } else {
      return { error: "Navigation is only available in browser context" }
    }
  } catch (error) {
    return { error: "Failed to navigate: " + (error instanceof Error ? error.message : "Unknown error") }
  }
}

/**
 * Get the current page/route information
 */
export async function getCurrentPage() {
  try {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      const currentUrl = window.location.href

      // Determine page name from path
      let pageName = "Unknown"
      if (currentPath === "/" || currentPath === "/dashboard") {
        pageName = "Dashboard"
      } else if (currentPath.includes("/analytics")) {
        pageName = "Analytics"
      } else if (currentPath.includes("/policies/book")) {
        pageName = "Policies Book"
      } else if (currentPath.includes("/policies/post")) {
        pageName = "Post Deal"
      } else if (currentPath.includes("/agents")) {
        pageName = "Agents"
      } else if (currentPath.includes("/clients")) {
        pageName = "Clients"
      } else if (currentPath.includes("/commissions")) {
        pageName = "Commissions"
      } else if (currentPath.includes("/settings")) {
        pageName = "Settings"
      }

      return {
        data: {
          current_path: currentPath,
          current_url: currentUrl,
          page_name: pageName
        },
        success: true
      }
    } else {
      return { error: "Page information is only available in browser context" }
    }
  } catch (error) {
    return { error: "Failed to get current page" }
  }
}

/**
 * Get agent hierarchy/tree information
 */
export async function getAgentHierarchy() {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()

    if (!auth?.user?.id) {
      return { error: "User not authenticated" }
    }

    const response = await fetch('/api/agents?view=tree')

    if (!response.ok) {
      return { error: "Failed to fetch agent hierarchy" }
    }

    const data = await response.json()

    return {
      data: {
        tree: data.tree,
        message: "Agent hierarchy retrieved successfully"
      },
      success: true
    }
  } catch (error) {
    return { error: "Failed to fetch agent hierarchy" }
  }
}

