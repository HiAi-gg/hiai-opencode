import { type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { isTelemetryActive } from './index';

const TRACER_NAME = 'hiai-opencode';

function getTracer() {
  if (!isTelemetryActive()) return null;
  return trace.getTracer(TRACER_NAME);
}

export async function instrumentToolExecution<T>(
  tool: string,
  _args: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  if (!tracer) return fn();

  return tracer.startActiveSpan(`tool.${tool}`, async (span) => {
    const start = Date.now();
    span.setAttribute('tool.name', tool);
    try {
      const result = await fn();
      span.setAttribute('tool.duration_ms', Date.now() - start);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setAttribute('tool.duration_ms', Date.now() - start);
      recordException(span, err);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function instrumentLspRequest<T>(
  serverId: string,
  method: string,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  if (!tracer) return fn();

  return tracer.startActiveSpan(`lsp.${serverId}.${method}`, async (span) => {
    const start = Date.now();
    span.setAttribute('lsp.server', serverId);
    span.setAttribute('lsp.method', method);
    try {
      const result = await fn();
      span.setAttribute('lsp.duration_ms', Date.now() - start);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setAttribute('lsp.duration_ms', Date.now() - start);
      recordException(span, err);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function instrumentMcpRequest<T>(
  serverId: string,
  method: string,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  if (!tracer) return fn();

  return tracer.startActiveSpan(`mcp.${serverId}.${method}`, async (span) => {
    const start = Date.now();
    span.setAttribute('mcp.server', serverId);
    span.setAttribute('mcp.method', method);
    try {
      const result = await fn();
      span.setAttribute('mcp.duration_ms', Date.now() - start);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setAttribute('mcp.duration_ms', Date.now() - start);
      recordException(span, err);
      throw err;
    } finally {
      span.end();
    }
  });
}

function recordException(span: Span, err: unknown) {
  span.recordException(err as Error);
  const message = err instanceof Error ? err.message : String(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message });
}
