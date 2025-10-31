// supabase/functions/enqueue-parse-jobs/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Job = { path: string }
type Body = { carrier: string; agencyId: string; jobs: Job[] }

const must = (v: string | undefined, name: string) => {
  if (!v) throw new Error(`${name} is not set in Edge function env`);
  return v;
};
const SUPABASE_URL       = must(Deno.env.get('SUPABASE_URL'), 'SUPABASE_URL');
const SERVICE_ROLE_KEY   = must(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), 'SUPABASE_SERVICE_ROLE_KEY');
const POLICY_REPORTS_BUCKET = must(Deno.env.get('POLICY_REPORTS_BUCKET'), 'POLICY_REPORTS_BUCKET');
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function validate(body: any): { ok: true; data: Body } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' }
  const { carrier, agencyId, jobs } = body
  if (!carrier || typeof carrier !== 'string') return { ok: false, error: 'carrier is required' }
  if (!agencyId || typeof agencyId !== 'string') return { ok: false, error: 'agencyId is required' }
  if (!Array.isArray(jobs) || jobs.length === 0) return { ok: false, error: 'jobs[] is required' }
  for (const j of jobs) {
    if (!j || typeof j !== 'object' || typeof j.path !== 'string') {
      return { ok: false, error: 'each job must be { path: string }' }
    }
  }
  return { ok: true, data: { carrier, agencyId, jobs } }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const parsed = validate(await req.json().catch(() => null))
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400 })
  }

  const { carrier, agencyId, jobs } = parsed.data

  // TODO (optional): verify JWT and tenant membership here if you want auth on this function

  const results: Array<{ path: string; msgId?: number; error?: string }> = []
  for (const j of jobs) {
    const { data: msgId, error } = await sb.rpc('enqueue_policy_report_parse_job', {
      p_path: j.path,
      p_carrier: carrier,
      p_agency_id: agencyId,
      p_priority: 0,
      p_delay_sec: 0,
      p_bucket: POLICY_REPORTS_BUCKET,
    })
    results.push({ path: j.path, msgId: msgId ?? undefined, error: error?.message })
  }

  const failures = results.filter(r => r.error)
  return new Response(
    JSON.stringify({
      ok: failures.length === 0,
      enqueued: results.length - failures.length,
      failed: failures
    }),
    { headers: { 'content-type': 'application/json' } }
  )
})
