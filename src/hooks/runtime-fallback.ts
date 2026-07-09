import type { BobConfig, HookSet } from '../types';

export function createRuntimeFallback(_config: BobConfig): HookSet {
  return {
    'chat.params': async (_input, output) => {
      if (output.maxOutputTokens && output.maxOutputTokens > 32_000) {
        output.maxOutputTokens = 32_000;
      }
    },
  };
}
