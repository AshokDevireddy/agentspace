import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface AuthenticatedUser {
  id: string          // public.users.id
  authUserId: string  // auth.users.id
  isAdmin: boolean
  agencyId: string | null
}

type AuthSuccess = {
  user: AuthenticatedUser
  supabaseAdmin: SupabaseClient
}

type AuthFailure = NextResponse

/**
 * Authenticate the current request and resolve the public users record.
 * Consolidates the three admin indicators (is_admin, perm_level, role).
 * Returns the authenticated user profile or an error NextResponse.
 */
export async function authenticateRoute(): Promise<AuthSuccess | AuthFailure> {
  const supabaseUser = await createServerClient()
  const { data: { user: authUser } } = await supabaseUser.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, is_admin, perm_level, role, agency_id")
    .eq("auth_user_id", authUser.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const isAdmin = profile.is_admin ||
    profile.perm_level === "admin" ||
    profile.role === "admin"

  return {
    user: {
      id: profile.id,
      authUserId: authUser.id,
      isAdmin,
      agencyId: profile.agency_id,
    },
    supabaseAdmin,
  }
}

/**
 * Type guard: returns true if the result is an error NextResponse.
 * Uses structural check (not instanceof) for reliability across module boundaries.
 */
export function isAuthError(result: AuthSuccess | AuthFailure): result is AuthFailure {
  return !('user' in result)
}

/**
 * Null-safe agency comparison. Returns true only when both IDs are
 * non-null and equal — prevents null-null matches from granting access.
 */
export function isSameAgency(
  agencyIdA: string | null | undefined,
  agencyIdB: string | null | undefined,
): boolean {
  return !!agencyIdA && !!agencyIdB && agencyIdA === agencyIdB
}

/**
 * Authorize access to a specific agent (target).
 * - Self-access: always allowed
 * - Admin: allowed if target is in the same agency (null agency_id denied)
 * - Agent: allowed only if target is in their downline
 *
 * Returns true if authorized, or a 403 NextResponse.
 */
export async function authorizeAgentAccess(
  supabaseAdmin: SupabaseClient,
  currentUser: AuthenticatedUser,
  targetAgentId: string,
): Promise<true | NextResponse> {
  // Self-access is always allowed
  if (currentUser.id === targetAgentId) return true

  if (currentUser.isAdmin) {
    if (!currentUser.agencyId) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Admin account has no agency assignment" },
        { status: 403 },
      )
    }

    // Admin: verify the target belongs to the same agency
    const { data: target } = await supabaseAdmin
      .from("users")
      .select("agency_id")
      .eq("id", targetAgentId)
      .single()

    if (!target || !isSameAgency(target.agency_id, currentUser.agencyId)) {
      return NextResponse.json(
        { error: "Forbidden", detail: "Agent is not in your agency" },
        { status: 403 },
      )
    }
    return true
  }

  // Agent: must be in downline
  const { data: downlines, error: downlineError } = await supabaseAdmin
    .rpc("get_agent_downline", { agent_id: currentUser.id })

  if (downlineError || !downlines) {
    console.error("Downline fetch error:", downlineError ?? "RPC returned null data")
    return NextResponse.json(
      { error: "Failed to verify permissions", detail: "Could not check downline relationships" },
      { status: 500 },
    )
  }

  const downlineIds = (downlines as { id: string }[]).map((d) => d.id)
  if (!downlineIds.includes(targetAgentId)) {
    return NextResponse.json(
      { error: "Forbidden", detail: "You can only access agents in your downline tree" },
      { status: 403 },
    )
  }

  return true
}
