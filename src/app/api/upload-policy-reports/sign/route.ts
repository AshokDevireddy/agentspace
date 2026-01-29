// app/api/upload-policy-reports/sign/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getApiBaseUrl } from "@/lib/api-config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// ---- helpers ----
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Initialize S3 client (reused across requests)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ---- POST /api/upload-policy-reports/sign ----
export async function POST(req: NextRequest) {
  try {
    // Authenticate via session
    const session = await getSession();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = session.accessToken;
    const apiUrl = getApiBaseUrl();

    // Get user info from Django (includes agency_id)
    const userResponse = await fetch(`${apiUrl}/api/user/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await userResponse.json();
    const agencyId = userData.agency_id;

    if (!agencyId) {
      return NextResponse.json({ error: "No agency for user" }, { status: 400 });
    }

    // Input: { jobId, files: [{ fileName, contentType, size }] }
    const body = await req.json().catch(() => null);
    const jobId = body?.jobId as string | undefined;
    const files = Array.isArray(body?.files)
      ? body.files as Array<
        { fileName: string; contentType: string; size: number }
      >
      : [];
    if (!jobId || files.length === 0) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const ALLOWED = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file

    // Verify job exists via Django
    const verifyResponse = await fetch(`${apiUrl}/api/ingest/jobs/${jobId}/verify`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!verifyResponse.ok) {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    const bucket = process.env.AWS_S3_BUCKET_NAME!;
    if (!bucket) {
      return NextResponse.json({ error: "Missing AWS_S3_BUCKET_NAME" }, {
        status: 500,
      });
    }

    const results: Array<
      {
        fileId: string;
        fileName: string;
        objectKey: string;
        presignedUrl: string;
        contentType: string;
        size: number;
        expiresInSeconds: number;
      }
    > = [];

    for (const f of files) {
      const fileName = String(f?.fileName || "");
      const contentType = String(f?.contentType || "");
      const size = Number(f?.size ?? 0);
      if (!fileName || !contentType || Number.isNaN(size)) {
        return NextResponse.json({ error: "Bad request (file fields)" }, {
          status: 400,
        });
      }
      if (!ALLOWED.includes(contentType)) {
        return NextResponse.json(
          { error: `Invalid file type: ${contentType}` },
          { status: 400 },
        );
      }
      if (size > MAX_BYTES) {
        return NextResponse.json({ error: `File too large: ${fileName}` }, {
          status: 413,
        });
      }

      const fileId = randomUUID();
      const safe = sanitizeFileName(fileName);
      const objectKey = `policy-reports/${agencyId}/${jobId}/${fileId}/${safe}`;

      // Upsert ingest_job_file via Django
      const upsertResponse = await fetch(`${apiUrl}/api/ingest/jobs/${jobId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          file_id: fileId,
          file_name: fileName,
          status: 'received',
        }),
      });

      if (!upsertResponse.ok) {
        const errorData = await upsertResponse.json().catch(() => ({}));
        return NextResponse.json({
          error: errorData.error || "Failed to register file",
        }, { status: 400 });
      }

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: contentType,
      });
      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 60,
      });
      results.push({
        fileId,
        fileName,
        objectKey,
        presignedUrl,
        contentType,
        size,
        expiresInSeconds: 60,
      });
    }

    return NextResponse.json({ jobId, files: results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, {
      status: 500,
    });
  }
}
