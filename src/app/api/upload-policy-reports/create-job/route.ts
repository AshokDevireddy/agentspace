// app/api/upload-policy-reports/create-job/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getApiBaseUrl } from "@/lib/api-config";
import { startWatcherForJob } from "@/lib/watchers/start-watcher";

// Input schema using Zod - agencyId is derived from auth
const CreateJobSchema = z.object({
    expectedFiles: z.number().int().min(0),
    clientJobId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
    try {
        // Get authenticated session
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const accessToken = session.accessToken;
        const apiUrl = getApiBaseUrl();

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
        const { expectedFiles, clientJobId } = parsed.data;
        console.debug("[create-job] validated", {
            expectedFiles,
            hasClientJobId: !!clientJobId,
        });

        // Call Django endpoint to create job
        // Django handles: authentication, agency_id from token, idempotency check
        const djangoResponse = await fetch(`${apiUrl}/api/ingest/jobs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                expected_files: expectedFiles,
                client_job_id: clientJobId,
            }),
        });

        const djangoData = await djangoResponse.json();

        if (!djangoResponse.ok) {
            console.error("[create-job] Django error", {
                status: djangoResponse.status,
                data: djangoData,
            });
            return NextResponse.json(
                { error: djangoData.error || "Failed to create job" },
                { status: djangoResponse.status }
            );
        }

        const job = djangoData.job;
        const isExisting = djangoData.existing === true;

        // If this is a newly created job (not returned from idempotency check), invoke watcher
        if (!isExisting) {
            console.log("[create-job] invoking watcher Lambda for new job", {
                jobId: job.jobId,
            });
            const watcherResult = await startWatcherForJob({
                jobId: job.jobId,
                agencyId: job.agencyId,
                expectedFiles: job.expectedFiles,
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
        }

        console.debug("[create-job] result", { jobId: job.jobId, existing: isExisting });
        return NextResponse.json({ job }, { status: isExisting ? 200 : 201 });
    } catch (e: unknown) {
        console.error("[create-job] unhandled error", e);
        const message = e instanceof Error ? e.message : "Internal error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
