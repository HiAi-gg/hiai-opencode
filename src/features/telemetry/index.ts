import type { BobConfig } from "../../types";

type TelemetryConfig = BobConfig["telemetry"];

let sdk: { shutdown: () => Promise<void> } | null = null;
let initialized = false;

export async function initTelemetry(
  config: TelemetryConfig | undefined,
): Promise<void> {
  if (initialized) return;
  if (!config?.enabled) return;

  const endpoint = config.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;

  try {
    // Optional deps — telemetry stays off when the otel packages aren't
    // installed (we list only the API + HTTP exporter as direct deps; the
    // SDK + resources + semantic-conventions are optional peer deps).
    // @ts-ignore — optional runtime dep
    const sdkNode = await import("@opentelemetry/sdk-node").catch(() => null);
    // biome-ignore format: single-line required for @ts-ignore to suppress next line
    // @ts-ignore — optional runtime dep
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http").catch(() => ({}));
    // biome-ignore format: single-line required for @ts-ignore to suppress next line
    // @ts-ignore — optional runtime dep
    const { Resource } = await import("@opentelemetry/resources").catch(() => ({}));
    // biome-ignore format: single-line required for @ts-ignore to suppress next line
    // @ts-ignore — optional runtime dep
    const { SEMRESATTRS_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions").catch(() => ({}));

    if (!sdkNode) {
      console.warn(
        "[hiai-opencode] Telemetry disabled: @opentelemetry/sdk-node not installed",
      );
      return;
    }

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
