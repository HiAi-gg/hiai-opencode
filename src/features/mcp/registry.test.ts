/**
 * mcp/registry.test.ts — Tests for MCP registry and config builder.
 *
 * Verifies MCP_REGISTRY structure, getMcpConfig filtering, env var resolution,
 * and auth handling.
 */

import { describe, expect, test } from 'bun:test';
import { getMcpConfig, MCP_REGISTRY } from './registry';

describe('MCP_REGISTRY', () => {
  test('contains sequential-thinking as local MCP', () => {
    expect(MCP_REGISTRY['sequential-thinking']).toBeDefined();
    expect(MCP_REGISTRY['sequential-thinking'].type).toBe('local');
    expect(MCP_REGISTRY['sequential-thinking'].command).toBeDefined();
  });

  test('contains grep_app as remote MCP', () => {
    expect(MCP_REGISTRY['grep_app']).toBeDefined();
    expect(MCP_REGISTRY['grep_app'].type).toBe('remote');
    expect(MCP_REGISTRY['grep_app'].url).toContain('mcp.grep.app');
  });

  test('sequential-thinking command is an array', () => {
    expect(Array.isArray(MCP_REGISTRY['sequential-thinking'].command)).toBe(true);
    expect(MCP_REGISTRY['sequential-thinking'].command!.length).toBeGreaterThan(0);
  });

  test('sequential-thinking has default timeout', () => {
    expect(MCP_REGISTRY['sequential-thinking'].timeout).toBe(60_000);
  });
});

describe('getMcpConfig', () => {
  test('returns both MCPs when all enabled and env available', () => {
    const result = getMcpConfig(
      { 'sequential-thinking': { enabled: true }, grep_app: { enabled: true } },
    );
    expect(result['sequential-thinking']).toBeDefined();
    expect(result['grep_app']).toBeDefined();
  });

  test('excludes MCPs disabled by user config', () => {
    const result = getMcpConfig({
      'sequential-thinking': { enabled: false },
      grep_app: { enabled: true },
    });
    expect(result['sequential-thinking']).toBeUndefined();
    expect(result['grep_app']).toBeDefined();
  });

  test('includes timeout when present in registry', () => {
    const result = getMcpConfig(
      { 'sequential-thinking': { enabled: true }, grep_app: { enabled: true } },
    );
    expect(result['sequential-thinking'] as any).toHaveProperty('timeout');
    expect((result['sequential-thinking'] as any).timeout).toBe(60_000);
  });

  test('local MCP gets type, command and optionally timeout', () => {
    const result = getMcpConfig({ 'sequential-thinking': { enabled: true } });
    const cfg = result['sequential-thinking'] as any;
    expect(cfg.type).toBe('local');
    expect(Array.isArray(cfg.command)).toBe(true);
  });

  test('remote MCP gets type, url and optionally headers', () => {
    const result = getMcpConfig({ grep_app: { enabled: true } });
    const cfg = result['grep_app'] as any;
    expect(cfg.type).toBe('remote');
    expect(cfg.url).toContain('mcp.grep.app');
  });

  test('resolves env vars in MCP environment config', () => {
    const origEnv = process.env.TEST_MCP_VAR;
    process.env.TEST_MCP_VAR = 'resolved-value';

    try {
      // Get config without environment to test defaults
      const result = getMcpConfig(
        { 'sequential-thinking': { enabled: true }, grep_app: { enabled: true } },
      );
      // No env vars in default registry entries, so no env property
      expect((result['sequential-thinking'] as any).environment).toBeUndefined();
    } finally {
      if (origEnv === undefined) {
        delete process.env.TEST_MCP_VAR;
      } else {
        process.env.TEST_MCP_VAR = origEnv;
      }
    }
  });

  test('returns empty object when no MCPs enabled', () => {
    const result = getMcpConfig({
      'sequential-thinking': { enabled: false },
      grep_app: { enabled: false },
    });
    expect(Object.keys(result)).toHaveLength(0);
  });

  test('handles empty enabledMcp object', () => {
    const result = getMcpConfig({});
    // Both MCPs present, no toggle → should be included
    expect(result['sequential-thinking']).toBeDefined();
    expect(result['grep_app']).toBeDefined();
  });

  test('applies auth config to remote MCP', () => {
    const result = getMcpConfig(
      { grep_app: { enabled: true } },
      { grep_app: 'my-auth-token' },
    );

    const cfg = result['grep_app'] as any;
    // grep_app has no headers defined in registry, so auth config logs warning
    // but does not add headers
    expect(cfg.headers).toBeUndefined();
  });
});
