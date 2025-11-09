// app/api/upload-policy-reports/create-job/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { startWatcherForJob } from "@/lib/watchers/start-watcher";

// Input schema using Zod
const CreateJobSchema = z.object({
    agencyId: z.string().uuid(),
    expectedFiles: z.number().int().min(0),
    clientJobId: z.string().min(1).optional(),
});

type CreateJobInput = z.infer<typeof CreateJobSchema>;

// Best-effort idempotent DDL creator
async function ensureSchema() {
    const supabase = createAdminClient();
    // Supabase PostgREST doesn't support arbitrary SQL directly; attempt a no-op read of the table
    // to detect existence. If missing (42P01), we can't create here without a SQL function.
    // For now, try creating via "pg_execute" RPC if present; otherwise, assume migrations created it.
    const ddl = `
  create extension if not exists pgcrypto;

  create table if not exists public.ingest_job (
    job_id          uuid primary key default gen_random_uuid(),
    agency_id       uuid not null,
    expected_files  int not null check (expected_files >= 0),
    parsed_files    int not null default 0 check (parsed_files >= 0),
    status          text not null 
                    check (status in ('parsing','ready','running','done','error'))
                    default 'parsing',
    client_job_id   text unique,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
  );

  create index if not exists ix_ingest_job_agency on public.ingest_job(agency_id);
  create index if not exists ix_ingest_job_status on public.ingest_job(status);

  create table if not exists public.ingest_job_file (
    file_id       uuid primary key,
    job_id        uuid not null references public.ingest_job(job_id) on delete cascade,
    file_name     text not null,
    status        text not null check (status in ('received','parsing','parsed_ok','parsed_error'))
                   default 'received',
    parsed_rows   int,
    error_message text,
    created_at    timestamptz default now(),
    updated_at    timestamptz default now()
  );

  create unique index if not exists ux_ingest_job_file_name
    on public.ingest_job_file(job_id, file_name);
  `;

    try {
        // Prefer an RPC if you have one deployed to execute SQL (optional).
        // If this RPC does not exist, this will fail silently and we rely on pre-existing tables.
        // You can create a function like:
        // create or replace function public.exec_sql(sql text) returns void language plpgsql as $$ begin execute sql; end; $$;
        // and expose it via PostgREST.
        const { error } = await (supabase as any).rpc?.("exec_sql", {
            sql: ddl,
        });
        if (error) {
            // Swallow in production; schema likely already exists via migrations.
            // console.debug('[create-job] exec_sql not available or failed:', error.message)
        }
    } catch {
        // Ignore; schema likely exists
    }
}

export async function POST(req: NextRequest) {
    const supabase = createAdminClient();

    try {
        // Ensure schema exists (best-effort)
        await ensureSchema();

        // Parse and validate body
        const json = await req.json().catch(() => null);
        console.debug("[create-job] request body", json);
        const parsed = CreateJobSchema.safeParse(json);
        if (!parsed.success) {
            console.error(
                "[create-job] validation failed",
                parsed.error.flatten(),
            );
            return NextResponse.json({
                error: "Invalid request",
                issues: parsed.error.flatten(),
            }, { status: 400 });
        }
        const { agencyId, expectedFiles, clientJobId } = parsed
            .data as CreateJobInput;
        console.debug("[create-job] validated", {
            agencyId,
            expectedFiles,
            hasClientJobId: !!clientJobId,
        });

        // Idempotency: if clientJobId supplied, check existing
        if (clientJobId) {
            const { data: existing, error: findErr } = await supabase
                .from("ingest_job")
                .select(
                    "job_id, agency_id, expected_files, parsed_files, status, client_job_id, created_at, updated_at",
                )
                .eq("client_job_id", clientJobId)
                .maybeSingle();

            if (findErr) {
                console.error("[create-job] find existing error", findErr);
                return NextResponse.json({ error: findErr.message }, {
                    status: 500,
                });
            }

            if (existing) {
                console.debug("[create-job] found existing", {
                    jobId: existing.job_id,
                });
                if (
                    existing.agency_id === agencyId &&
                    existing.expected_files === expectedFiles
                ) {
                    return NextResponse.json({
                        job: {
                            jobId: existing.job_id,
                            agencyId: existing.agency_id,
                            expectedFiles: existing.expected_files,
                            parsedFiles: existing.parsed_files,
                            status: existing.status,
                            createdAt: existing.created_at,
                            updatedAt: existing.updated_at,
                            clientJobId: existing.client_job_id ?? undefined,
                        },
                    }, { status: 200 });
                }
                return NextResponse.json({
                    error:
                        "Idempotency conflict: clientJobId exists with different values",
                }, { status: 409 });
            }
        }

        // Create new job
        const insertPayload: any = {
            agency_id: agencyId,
            expected_files: expectedFiles,
            // status defaults to 'parsing'
            // parsed_files defaults to 0
        };
        if (clientJobId) insertPayload.client_job_id = clientJobId;
        console.debug("[create-job] inserting", insertPayload);

        const { data: inserted, error: insErr } = await supabase
            .from("ingest_job")
            .insert([insertPayload])
            .select(
                "job_id, agency_id, expected_files, parsed_files, status, client_job_id, created_at, updated_at",
            )
            .single();

        if (insErr) {
            console.error("[create-job] insert error", insErr);
            return NextResponse.json({ error: insErr.message }, {
                status: 500,
            });
        }

        // Invoke watcher Lambda for the newly created job
        console.log("[create-job] invoking watcher Lambda for new job", {
            jobId: inserted.job_id,
        });
        const watcherResult = await startWatcherForJob({
            jobId: inserted.job_id,
            agencyId: inserted.agency_id,
            expectedFiles: inserted.expected_files,
            maxWatchSeconds: 300,
        });
        if (watcherResult.success) {
            console.log(
                "[create-job] watcher Lambda invocation initiated successfully",
            );
        } else {
            console.error(
                "[create-job] watcher Lambda invocation failed:",
                watcherResult.error,
            );
        }

        console.debug("[create-job] created", { jobId: inserted.job_id });
        return NextResponse.json({
            job: {
                jobId: inserted.job_id,
                agencyId: inserted.agency_id,
                expectedFiles: inserted.expected_files,
                parsedFiles: inserted.parsed_files,
                status: inserted.status,
                createdAt: inserted.created_at,
                updatedAt: inserted.updated_at,
                clientJobId: inserted.client_job_id ?? undefined,
            },
        }, { status: 201 });
    } catch (e: any) {
        console.error("[create-job] unhandled error", e);
        return NextResponse.json({ error: e?.message || "Internal error" }, {
            status: 500,
        });
    }
}
