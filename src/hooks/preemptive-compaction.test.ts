import { describe, expect, test } from 'bun:test';
import { createPreemptiveCompaction } from './preemptive-compaction';
import type { BobConfig } from '../types';

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: {
      bob: { model: 'openai/gpt-5.5' },
      build: { model: 'opencode-go/deepseek-v4-pro' },
      explore: { model: 'opencode-go/deepseek-v4-flash' },
      critic: { model: 'opencode-go/mimo-v2.5-pro' },
      general: { model: 'opencode-go/deepseek-v4-flash' },
      writer: { model: 'opencode-go/deepseek-v4-flash' },
      designer: { model: 'opencode-go/kimi-k2.7-code' },
      manager: { model: 'opencode-go/deepseek-v4-flash' },
      vision: { model: 'opencode-go/mimo-v2.5' },
    },
    ...overrides,
  };
}

describe('preemptive-compaction', () => {
  test('low message count → no console.log', async () => {
    const config = makeConfig();
    const hookSet = createPreemptiveCompaction(config);
    const transform = hookSet['experimental.chat.messages.transform'];
    expect(transform).toBeDefined();

    const messages = [
      { info: { role: 'user' as const }, parts: [{ type: 'text', text: 'hello' }] },
      { info: { role: 'assistant' as const }, parts: [{ type: 'text', text: 'hi' }] },
    ];

    let logCalled = false;
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logCalled = true;
      originalLog(...args);
    };

    try {
      await transform!({} as Parameters<NonNullable<typeof transform>>[0], {
        messages,
      } as unknown as Parameters<NonNullable<typeof transform>>[1]);
      expect(logCalled).toBe(false);
    } finally {
      console.log = originalLog;
    }
  });

  test('high message count → triggers console.log', async () => {
    const config = makeConfig();
    const hookSet = createPreemptiveCompaction(config);
    const transform = hookSet['experimental.chat.messages.transform'];
    expect(transform).toBeDefined();

    // Build messages with enough total parts to exceed 200 threshold
    // Each message has 2 parts, so 101 messages × 2 = 202 parts
    const messages = Array.from({ length: 101 }, (_, i) => ({
      info: { role: 'user' as const },
      parts: [
        { type: 'text' as const, text: `msg ${i}-1` },
        { type: 'text' as const, text: `msg ${i}-2` },
      ],
    }));

    let logCalled = false;
    let logMessage = '';
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logCalled = true;
      logMessage = args.join(' ');
      originalLog(...args);
    };

    try {
      await transform!({} as Parameters<NonNullable<typeof transform>>[0], {
        messages,
      } as unknown as Parameters<NonNullable<typeof transform>>[1]);
      expect(logCalled).toBe(true);
      expect(logMessage).toContain('High message count');
    } finally {
      console.log = originalLog;
    }
  });

  test('handles messages with undefined parts gracefully', async () => {
    const config = makeConfig();
    const hookSet = createPreemptiveCompaction(config);
    const transform = hookSet['experimental.chat.messages.transform'];
    expect(transform).toBeDefined();

    const messages = [
      { info: { role: 'user' as const }, parts: undefined },
      { info: { role: 'assistant' as const }, parts: [{ type: 'text', text: 'hi' }] },
    ];

    // Should not throw
    await transform!({} as Parameters<NonNullable<typeof transform>>[0], {
      messages,
    } as unknown as Parameters<NonNullable<typeof transform>>[1]);
  });


});
