import type { BobConfig, HookSet } from '../types';

export function createCompactionTodoPreserverHook(_config: BobConfig): HookSet {
  return {
    'experimental.session.compacting': async (
      _input: Parameters<NonNullable<HookSet['experimental.session.compacting']>>[0],
      output: Parameters<NonNullable<HookSet['experimental.session.compacting']>>[1],
    ) => {
      if (output?.context) {
        output.context.push('[hiai-opencode] Preserve all TODO items during compaction.');
      }
    },
  };
}
