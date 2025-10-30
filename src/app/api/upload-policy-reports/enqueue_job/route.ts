// app/api/parse-jobs/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type Job = { bucket: string; path: string }
type Body = { carrier: string; agencyId: string; jobs: Job[] }

function validateBody(body: any): { ok: true; data: Body } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' }
  const { carrier, agencyId, jobs } = body
  if (!carrier || typeof carrier !== 'string') return { ok: false, error: 'carrier is required' }
  if (!agencyId || typeof agencyId !== 'string') return { ok: false, error: 'agencyId is required' }
  if (!Array.isArray(jobs) || jobs.length === 0) return { ok: false, error: 'jobs[] is required' }
  for (const j of jobs) {
    if (!j || typeof j !== 'object') return { ok: false, error: 'job must be object' }
    if (!j.bucket || typeof j.bucket !== 'string') return { ok: false, error: 'job.bucket is required' }
    if (!j.path || typeof j.path !== 'string') return { ok: false, error: 'job.path is required' }
  }
  return { ok: true, data: { carrier, agencyId, jobs } }
}

export async function POST(req: Request) {
  // Next 15 returns a Promise here; Next 14 returns directly — `await` works for both.
  const cookieStore = await cookies()

  // NEW cookie API: getAll & setAll
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Must return [{ name, value }]
        getAll() {
          // Next cookies().getAll() returns { name, value }[]
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }))
        },
        // Receives [{ name, value, options }]
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options })
          }
        },
      },
    }
  )

  const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser()
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const v = validateBody(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { carrier, agencyId, jobs } = v.data

  // Service-role client for privileged operations
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
  )

  // (Optional) tenant check
  const { data: membership, error: memErr } = await admin
    .from('user_agencies')
    .select('agency_id')
    .eq('user_id', user.id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (memErr || !membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // (Optional) path guard
  for (const j of jobs) {
    if (!j.path.startsWith(`${carrier}/`)) {
      return NextResponse.json({ error: `Invalid path prefix for ${j.path}` }, { status: 400 })
    }
  }

  // Enqueue via SECURITY DEFINER RPC
  const results: Array<{ path: string; msgId?: number; error?: string }> = []
  for (const j of jobs) {
    const { data: msgId, error } = await admin.rpc('enqueue_parse_job', {
      p_bucket: j.bucket,
      p_path: j.path,
      p_carrier: carrier,
      p_agency_id: agencyId,
      p_priority: 0,
      p_delay_sec: 0,
    })
    results.push({ path: j.path, msgId: msgId ?? undefined, error: error?.message })
  }

  const failures = results.filter(r => r.error)
  return NextResponse.json({
    ok: failures.length === 0,
    enqueued: results.length - failures.length,
    failed: failures,
  })
}
