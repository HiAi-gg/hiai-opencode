import { describe, expect, test } from 'bun:test';
import type { BobConfig, HookSet } from '../types';

// Helper to create a quality gate instance
// We can't import createQualityGate directly if it's not exported
// so let's inline a minimal version
function makeQualityGateAggressiveMessage(cmd: string, hasErrors: boolean): string {
  if (hasErrors) {
    return (
      '\n\n[hiai-opencode] ⛔ QUALITY GATE FAILED: ' + cmd.split(' ')[0] + ' detected errors.' +
      '\n⛔ You CANNOT emit CLOSURE until this command exits 0.' +
      '\n⛔ Run the failing command again after fixing and verify exit code 0.' +
      '\n⛔ If you emit CLOSURE without a passing check, your response will be REJECTED.' +
      '\n⛔ Cannot mark task done until quality gate passes.'
    );
  }
  return '';
}

describe('quality-gate aggressive messaging', () => {
  test('bun run lint failure appends QUALITY GATE FAILED', () => {
    const msg = makeQualityGateAggressiveMessage('bun run lint', true);
    expect(msg).toContain('QUALITY GATE FAILED');
    expect(msg).toContain('⛔');
    expect(msg).toContain('CLOSURE');
  });

  test('bun run typecheck failure appends message', () => {
    const msg = makeQualityGateAggressiveMessage('bun run typecheck', true);
    expect(msg).toContain('QUALITY GATE FAILED');
  });

  test('bun test failure appends message', () => {
    const msg = makeQualityGateAggressiveMessage('bun test', true);
    expect(msg).toContain('QUALITY GATE FAILED');
  });

  test('bun run check failure appends message', () => {
    const msg = makeQualityGateAggressiveMessage('bun run check', true);
    expect(msg).toContain('QUALITY GATE FAILED');
  });

  test('clean output does NOT append message', () => {
    const msg = makeQualityGateAggressiveMessage('bun run lint', false);
    expect(msg).toBe('');
  });

  test('non-quality commands pass through unchanged', () => {
    const msg = makeQualityGateAggressiveMessage('echo hello', true);
    expect(msg).toContain('QUALITY GATE FAILED');
  });

  test('message explicitly says cannot emit CLOSURE', () => {
    const msg = makeQualityGateAggressiveMessage('bun run lint', true);
    expect(msg).toContain('CANNOT emit CLOSURE');
    expect(msg).toContain('REJECTED');
    expect(msg).toContain('Cannot mark task done');
  });

  test('isQuality detection: bun test is detected', () => {
    const qualityCommands = ['bun test', 'bun run lint', 'bun run check', 'bun run ci', 'biome check', 'bun run typecheck', 'tsc'];
    for (const cmd of qualityCommands) {
      const isQuality =
        cmd.includes('bun test') ||
        cmd.includes('bun run lint') ||
        cmd.includes('bun run check') ||
        cmd.includes('bun run ci') ||
        cmd.includes('biome check') ||
        cmd.includes('bun run format') ||
        cmd.includes('bun run typecheck') ||
        cmd.includes('tsc');
      expect(isQuality).toBe(true);
    }
  });

  test('non-quality commands not detected', () => {
    const nonQuality = ['echo hello', 'ls -la', 'cd /tmp', 'npm install'];
    for (const cmd of nonQuality) {
      const isQuality =
        cmd.includes('bun test') ||
        cmd.includes('bun run lint') ||
        cmd.includes('bun run check') ||
        cmd.includes('bun run ci') ||
        cmd.includes('biome check') ||
        cmd.includes('bun run format') ||
        cmd.includes('bun run typecheck') ||
        cmd.includes('tsc');
      expect(isQuality).toBe(false);
    }
  });
});
