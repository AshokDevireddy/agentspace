import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { setLangfuseTracerProvider } from '@langfuse/tracing';
import { trace } from '@opentelemetry/api';

let initialized = false;
let sdk: NodeSDK | null = null;

/**
 * Initialize Langfuse OpenTelemetry instrumentation
 * This must be called before any tracing happens
 */
export function initializeLangfuse(): boolean {
  if (initialized) {
    return true;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    console.warn('[Langfuse] Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY - tracing disabled');
    return false;
  }

  try {
    const spanProcessor = new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl,
      exportMode: 'immediate', // Use immediate mode for serverless/Next.js
    });

    sdk = new NodeSDK({
      spanProcessors: [spanProcessor],
      instrumentations: [], // Disable auto-instrumentation
    });

    sdk.start();

    // Set the tracer provider for Langfuse tracing functions
    const provider = trace.getTracerProvider();
    if (provider) {
      setLangfuseTracerProvider(provider as any);
    }

    initialized = true;
    console.log('[Langfuse] OpenTelemetry instrumentation initialized successfully');
    return true;
  } catch (error) {
    console.error('[Langfuse] Failed to initialize OpenTelemetry instrumentation:', error);
    return false;
  }
}

/**
 * Check if Langfuse is initialized
 */
export function isLangfuseInitialized(): boolean {
  return initialized;
}

/**
 * Shutdown Langfuse gracefully
 */
export async function shutdownLangfuse(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    initialized = false;
    sdk = null;
    console.log('[Langfuse] OpenTelemetry instrumentation shut down');
  }
}
