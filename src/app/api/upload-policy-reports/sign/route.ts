// app/api/upload-policy-reports/sign/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createServerClient } from '@/lib/supabase/server';

// ---- helpers (trimmed from your original code) ----
function sanitizeCarrierName(carrierName: string): string {
  return carrierName
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .trim();
}

function generateStoragePath(agencyId: string, carrierName: string, fileName: string): string {
  const sanitizedCarrier = sanitizeCarrierName(carrierName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${agencyId}/${sanitizedCarrier}/${timestamp}_${sanitizedFileName}`;
}

async function getAgencyId(supabaseAdmin: any, userId: string): Promise<string> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('agency_id')
    .eq('auth_user_id', userId)
    .single();
  if (error || !user?.agency_id) throw new Error('No agency for user');
  return user.agency_id as string;
}

// ---- POST /api/upload-policy-reports/sign ----
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const userClient = await createServerClient();

    // Auth
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Input: { filename, type, size, carrier }
    const { filename, type, size, carrier } = await req.json();

    if (!filename || !carrier || !type || typeof size !== 'number') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    // Basic validation (per-file)
    const ALLOWED = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!ALLOWED.includes(type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file (adjust)
    if (size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    // Look up agency
    const agencyId = await getAgencyId(admin, user.id);

    // Build canonical path
    const path = generateStoragePath(agencyId, carrier, filename);

    // (Optional) rate limiting / bot check goes here

    // Create a short-lived, path-scoped signed upload URL
    const bucket = process.env.SUPABASE_POLICY_REPORTS_BUCKET_NAME!;
    if (!bucket) {
      return NextResponse.json({ error: 'Missing SUPABASE_POLICY_REPORTS_BUCKET_NAME' }, { status: 500 });
    }

    // SDKs differ slightly; in modern @supabase/supabase-js, this is available:
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true }); // upsert optional

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return the signed URL + canonical metadata
    return NextResponse.json({
      signedUrl: data.signedUrl,
      path,
      contentType: type,
      maxSize: MAX_BYTES,
      expiresInSeconds: 60, // typical short TTL (SDK sets actual expiry)
    });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
