import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const server = await createServerClient();

  try {
    // Identify current user
    const { data: { user } } = await server.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, agency_id, perm_level, role')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error('Error fetching current user:', currentUserError);
      return NextResponse.json({ error: 'Failed to resolve current user' }, { status: 500 });
    }

    const { data: options, error: rpcError } = await admin.rpc('get_static_filter_options', {
      p_user_id: currentUser.id
    });

    console.log('[FILTER-OPTIONS API] RPC raw response:', JSON.stringify(options, null, 2));
    console.log('[FILTER-OPTIONS API] RPC response type:', typeof options);
    console.log('[FILTER-OPTIONS API] Is array?', Array.isArray(options));
    if (options && typeof options === 'object') {
      console.log('[FILTER-OPTIONS API] Has statuses?', 'statuses' in options);
      console.log('[FILTER-OPTIONS API] statuses value:', options.statuses);
      console.log('[FILTER-OPTIONS API] statuses type:', typeof options.statuses);
      console.log('[FILTER-OPTIONS API] statuses is array?', Array.isArray(options.statuses));
    }

    if (rpcError) {
      console.error('get_static_filter_options RPC error:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json(options ?? {}, { status: 200 });

  } catch (err: any) {
    console.error('Error in filter-options API:', err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch filter options" },
      { status: 500 }
    );
  }
}