// app/api/parse-jobs/route.ts
import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth/get-user-context'

type Job = { bucket: string; path: string }
// SECURITY: agencyId is now optional - we derive it from authenticated user
type Body = { carrier: string; agencyId?: string; jobs: Job[] }

function validateBody(body: any): { ok: true; data: Body } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' }
  const { carrier, jobs } = body
  if (!carrier || typeof carrier !== 'string') return { ok: false, error: 'carrier is required' }
  // SECURITY: agencyId in body is now optional/ignored - we use authenticated user's agency
  if (!Array.isArray(jobs) || jobs.length === 0) return { ok: false, error: 'jobs[] is required' }
  for (const j of jobs) {
    if (!j || typeof j !== 'object') return { ok: false, error: 'job must be object' }
    if (!j.bucket || typeof j.bucket !== 'string') return { ok: false, error: 'job.bucket is required' }
    if (!j.path || typeof j.path !== 'string') return { ok: false, error: 'job.path is required' }
  }
  return { ok: true, data: { carrier, jobs } }
}

export async function POST(req: Request) {
  // SECURITY: Get agency ID from authenticated user, not from request body
  const userContextResult = await getUserContext()
  if (!userContextResult.success) {
    return NextResponse.json({ error: userContextResult.error }, { status: userContextResult.status })
  }
  const { agencyId, userId } = userContextResult.context

  const body = await req.json().catch(() => null)
  const v = validateBody(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { carrier, jobs } = v.data
  // SECURITY: agencyId comes from authenticated user, not from body

  // (Optional) path guard
  for (const j of jobs) {
    if (!j.path.startsWith(`${carrier}/`)) {
      return NextResponse.json({ error: `Invalid path prefix for ${j.path}` }, { status: 400 })
    }
  }

  // Enqueue via Django API
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const results: Array<{ path: string; msgId?: number; error?: string }> = []
  for (const j of jobs) {
    try {
      const response = await fetch(`${apiUrl}/api/ingest/enqueue-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': process.env.CRON_SECRET || '',
        },
        body: JSON.stringify({
          bucket: j.bucket,
          path: j.path,
          carrier,
          priority: 0,
          delay_sec: 0,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        results.push({ path: j.path, msgId: data.message_id ?? undefined })
      } else {
        results.push({ path: j.path, error: data.error || 'Failed to enqueue' })
      }
    } catch (err) {
      results.push({ path: j.path, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const failures = results.filter(r => r.error)
  return NextResponse.json({
    ok: failures.length === 0,
    enqueued: results.length - failures.length,
    failed: failures,
  })
}
