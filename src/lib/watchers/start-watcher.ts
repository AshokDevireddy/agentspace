// lib/watchers/start-watcher.ts
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || "us-east-1",
});

export interface StartWatcherParams {
    jobId: string;
    agencyId: string;
    expectedFiles: number;
    maxWatchSeconds?: number;
}

/**
 * Invokes the per-job watcher Lambda function asynchronously.
 * The watcher polls Supabase for job completion and calls the orchestrator RPC.
 */
export async function startWatcherForJob(
    params: StartWatcherParams,
): Promise<{ success: boolean; error?: string }> {
    const functionName = process.env.JOB_WATCHER_FUNCTION_NAME;
    const region = process.env.AWS_REGION || "us-east-1";

    console.log("[watcher] startWatcherForJob called", {
        jobId: params.jobId,
        agencyId: params.agencyId,
        expectedFiles: params.expectedFiles,
        maxWatchSeconds: params.maxWatchSeconds,
    });

    if (!functionName) {
        console.error("[watcher] JOB_WATCHER_FUNCTION_NAME not set");
        return {
            success: false,
            error: "Watcher function name not configured",
        };
    }

    console.log("[watcher] configuration", {
        functionName,
        region,
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    });

    const { jobId, agencyId, expectedFiles, maxWatchSeconds } = params;

    const payload: any = {
        jobId,
        agencyId,
        expectedFiles,
    };
    if (maxWatchSeconds !== undefined) {
        payload.maxWatchSeconds = maxWatchSeconds;
    }

    console.log("[watcher] invoking Lambda", {
        functionName,
        payload,
        invocationType: "Event",
    });

    try {
        const command = new InvokeCommand({
            FunctionName: functionName,
            InvocationType: "Event", // Async invocation
            Payload: JSON.stringify(payload),
        });

        const response = await lambdaClient.send(command);
        console.log("[watcher] Lambda invocation successful", {
            jobId,
            functionName,
            statusCode: response.StatusCode,
            requestId: response.$metadata.requestId,
        });
        return { success: true };
    } catch (error: any) {
        const msg = error?.message || "Unknown error";
        console.error("[watcher] Lambda invocation failed", {
            jobId,
            functionName,
            error: msg,
            errorCode: error?.code,
            errorName: error?.name,
            stack: error?.stack,
        });
        return { success: false, error: msg };
    }
}
