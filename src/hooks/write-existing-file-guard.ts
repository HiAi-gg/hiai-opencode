import type { BobConfig, HookSet } from '../types';

export function createWriteExistingFileGuard(_config: BobConfig): HookSet {
  const recentReads = new Map<string, Set<string>>();
  return {
    'tool.execute.before': async (input, output) => {
      const sid = input.sessionID;
      if (input.tool === 'read') {
        const args = output.args as { filePath?: string };
        if (args?.filePath) {
          if (!recentReads.has(sid)) recentReads.set(sid, new Set());
          recentReads.get(sid)?.add(args.filePath);
        }
      }
      if (input.tool === 'write' || input.tool === 'edit') {
        const args = output.args as { filePath?: string; path?: string };
        const fp = args?.filePath ?? args?.path;
        if (fp && !recentReads.get(sid)?.has(fp)) {
          console.log(`[hiai-opencode] Write/edit without prior Read: ${fp}`);
        }
      }
    },
    dispose: async () => {
      recentReads.clear();
    },
  };
}
