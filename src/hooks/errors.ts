/**
 * BlockingHookError — thrown by hooks that must halt execution.
 *
 * When `mergeHookSets` / `combineHookSets` chains multiple handlers for the
 * same hook point, regular errors are logged and swallowed so that
 * observability/recovery hooks don't break each other. A BlockingHookError
 * propagates through the chain immediately, ensuring the legal gate and
 * other safety-critical hooks can always halt the pipeline.
 */
export class BlockingHookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockingHookError";
  }
}
