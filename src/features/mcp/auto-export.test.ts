import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { buildStaticMcpPayload, autoExportStaticMcp } from "./auto-export";
import type { BobConfig } from "../../types";

const TMP = join(import.meta.dir, ".tmp-auto-export-test");

function baseConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    mcp: {
      "sequential-thinking": { enabled: true },
      grep_app: { enabled: true },
    },
    auth: {},
    ...overrides,
  } as BobConfig;
}

function resetTmp() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

describe("buildStaticMcpPayload", () => {
  test("emits both registry servers with correct shapes", () => {
    const payload = buildStaticMcpPayload(baseConfig());
    const servers = payload.mcpServers as Record<
      string,
      Record<string, unknown>
    >;
    expect(servers["sequential-thinking"]).toBeDefined();
    expect(servers["sequential-thinking"].command).toBe("npx");
    expect(Array.isArray(servers["sequential-thinking"].args)).toBe(true);
    expect(servers.grep_app).toBeDefined();
    expect(servers.grep_app.type).toBe("http");
    expect(servers.grep_app.url).toBe("https://mcp.grep.app");
    expect((payload._meta as Record<string, unknown>).generatedBy).toBe(
      "hiai-opencode",
    );
  });

  test("respects explicit { enabled: false }", () => {
    const payload = buildStaticMcpPayload(
      baseConfig({
        mcp: {
          "sequential-thinking": { enabled: false },
          grep_app: { enabled: true },
        },
      }),
    );
    const servers = payload.mcpServers as Record<string, unknown>;
    expect(servers["sequential-thinking"]).toBeUndefined();
    expect(servers.grep_app).toBeDefined();
  });

  test("passes through user-defined MCP with command", () => {
    const payload = buildStaticMcpPayload(
      baseConfig({
        mcp: {
          "sequential-thinking": { enabled: true },
          grep_app: { enabled: true },
          custom: {
            enabled: true,
            command: "node",
            args: ["server.js"],
          } as never,
        },
      }),
    );
    const servers = payload.mcpServers as Record<
      string,
      Record<string, unknown>
    >;
    expect(servers.custom).toBeDefined();
    expect(servers.custom.command).toBe("node");
  });

  test("ignores bare { enabled: true } passthrough without command/url", () => {
    const payload = buildStaticMcpPayload(
      baseConfig({
        mcp: {
          "sequential-thinking": { enabled: true },
          grep_app: { enabled: true },
          broken: { enabled: true } as never,
        },
      }),
    );
    const servers = payload.mcpServers as Record<string, unknown>;
    expect(servers.broken).toBeUndefined();
  });
});

describe("autoExportStaticMcp", () => {
  beforeEach(() => resetTmp());
  afterEach(() => resetTmp());

  test("if-missing writes when file absent", () => {
    delete process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP;
    delete process.env.HIAI_OPENCODE_MCP_EXPORT_PATH;
    autoExportStaticMcp(baseConfig(), TMP);
    const out = join(TMP, ".opencode", ".mcp.json");
    expect(existsSync(out)).toBe(true);
    const parsed = JSON.parse(readFileSync(out, "utf-8"));
    expect(parsed._meta.generatedBy).toBe("hiai-opencode");
  });

  test("if-missing skips when file exists", () => {
    delete process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP;
    delete process.env.HIAI_OPENCODE_MCP_EXPORT_PATH;
    const out = join(TMP, ".opencode", ".mcp.json");
    mkdirSync(join(TMP, ".opencode"), { recursive: true });
    writeFileSync(out, JSON.stringify({ existing: true }));
    autoExportStaticMcp(baseConfig(), TMP);
    const parsed = JSON.parse(readFileSync(out, "utf-8"));
    expect(parsed.existing).toBe(true);
    expect(parsed._meta).toBeUndefined();
  });

  test("off mode does not write", () => {
    process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP = "off";
    delete process.env.HIAI_OPENCODE_MCP_EXPORT_PATH;
    autoExportStaticMcp(baseConfig(), TMP);
    expect(existsSync(join(TMP, ".opencode", ".mcp.json"))).toBe(false);
    delete process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP;
  });

  test("always mode refreshes a managed file", () => {
    process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP = "always";
    delete process.env.HIAI_OPENCODE_MCP_EXPORT_PATH;
    const out = join(TMP, ".opencode", ".mcp.json");
    mkdirSync(join(TMP, ".opencode"), { recursive: true });
    writeFileSync(
      out,
      JSON.stringify({
        _meta: { generatedBy: "hiai-opencode" },
        mcpServers: {},
      }),
    );
    autoExportStaticMcp(baseConfig(), TMP);
    const parsed = JSON.parse(readFileSync(out, "utf-8"));
    expect(parsed.mcpServers["sequential-thinking"]).toBeDefined();
    delete process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP;
  });

  test("always mode safe refuses to overwrite non-managed file", () => {
    process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP = "always";
    delete process.env.HIAI_OPENCODE_EXPORT_MCP_MODE;
    delete process.env.HIAI_OPENCODE_MCP_EXPORT_PATH;
    const out = join(TMP, ".opencode", ".mcp.json");
    mkdirSync(join(TMP, ".opencode"), { recursive: true });
    writeFileSync(out, JSON.stringify({ someoneElse: true }));
    autoExportStaticMcp(baseConfig(), TMP);
    const parsed = JSON.parse(readFileSync(out, "utf-8"));
    expect(parsed.someoneElse).toBe(true);
    expect(parsed._meta).toBeUndefined();
    delete process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP;
  });

  test("HIAI_OPENCODE_MCP_EXPORT_PATH overrides output location", () => {
    delete process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP;
    process.env.HIAI_OPENCODE_MCP_EXPORT_PATH = join(TMP, "custom.json");
    autoExportStaticMcp(baseConfig(), TMP);
    expect(existsSync(join(TMP, "custom.json"))).toBe(true);
    expect(existsSync(join(TMP, ".opencode", ".mcp.json"))).toBe(false);
    delete process.env.HIAI_OPENCODE_MCP_EXPORT_PATH;
  });
});
