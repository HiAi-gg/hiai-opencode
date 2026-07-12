import type { BobConfig } from "../../types";

type TelemetryConfig = BobConfig["telemetry"];

let sdk: { shutdown: () => Promise<void> } | null = null;
let initialized = false;

// Optional deps — telemetry stays off when the otel packages aren't
// installed. We list only the API as a direct dep; the SDK, HTTP exporter,
// resources, and semantic-conventions are optional peer deps. The dynamic
// imports use a non-literal specifier so TypeScript does not require the
// modules to be present at type-check time, and the try/catch handles their
// runtime absence gracefully.
async function loadSdkNode() {
  try {
    return await import("@opentelemetry/sdk-node" as string);
  } catch {
    console.warn("[hiai-opencode] @opentelemetry/sdk-node not available");
    return null;
  }
}

async function loadOtlpExporter() {
  try {
    return await import("@opentelemetry/exporter-trace-otlp-http" as string);
  } catch {
    console.warn(
      "[hiai-opencode] @opentelemetry/exporter-trace-otlp-http not available",
    );
    return null;
  }
}

async function loadResources() {
  try {
    return await import("@opentelemetry/resources" as string);
  } catch {
    console.warn("[hiai-opencode] @opentelemetry/resources not available");
    return null;
  }
}

async function loadSemanticConventions() {
  try {
    return await import("@opentelemetry/semantic-conventions" as string);
  } catch {
    console.warn(
      "[hiai-opencode] @opentelemetry/semantic-conventions not available",
    );
    return null;
  }
}

export async function initTelemetry(
  config: TelemetryConfig | undefined,
): Promise<void> {
  if (initialized) return;
  if (!config?.enabled) return;

  const endpoint = config.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;

  try {
    const sdkNode = await loadSdkNode();
    if (!sdkNode) {
      console.warn(
        "[hiai-opencode] Telemetry disabled: @opentelemetry/sdk-node not installed",
      );
      return;
    }

    const otlp = (await loadOtlpExporter()) ?? {};
    const resources = (await loadResources()) ?? {};
    const semconv = (await loadSemanticConventions()) ?? {};

    const OTLPTraceExporter = otlp.OTLPTraceExporter;
    const Resource = resources.Resource;
    const SEMRESATTRS_SERVICE_NAME = semconv.SEMRESATTRS_SERVICE_NAME;

    const serviceName =
      config.serviceName ?? process.env.OTEL_SERVICE_NAME ?? "hiai-opencode";
    const sampleRate = clampSampleRate(config.sampleRate ?? 0.1);

    const sampler = new sdkNode.tracing.ParentBasedSampler({
      root: new sdkNode.tracing.TraceIdRatioBasedSampler(sampleRate),
    });

    const instance = new sdkNode.NodeSDK({
      resource: new Resource({ [SEMRESATTRS_SERVICE_NAME]: serviceName }),
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      sampler,
    });

    instance.start();
    sdk = instance;
    initialized = true;
  } catch (err) {
    console.warn(
      `[hiai-opencode] Telemetry init failed (continuing without): ${(err as Error).message}`,
    );
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch (err) {
    console.warn(
      `[hiai-opencode] Telemetry shutdown failed: ${(err as Error).message}`,
    );
  } finally {
    sdk = null;
    initialized = false;
  }
}

export function isTelemetryActive(): boolean {
  return initialized;
}

function clampSampleRate(value: number): number {
  if (Number.isNaN(value)) return 0.1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
