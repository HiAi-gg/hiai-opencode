export function safeCreateHook<T>(
  hookNameOrFactory: string | (() => T | null),
  factoryOrOptions?: (() => T | null) | { enabled?: boolean },
  options?: { enabled?: boolean }
): T | null {
  // Handle both 2-arg and 3-arg call signatures
  let factory: () => T | null;
  let enabled: boolean;

  if (typeof hookNameOrFactory === 'string') {
    // 3-arg: safeCreateHook(hookName, factory, options)
    factory = factoryOrOptions as () => T | null;
    enabled = options?.enabled ?? true;
  } else {
    // 2-arg: safeCreateHook(factory, options)
    factory = hookNameOrFactory;
    enabled = (factoryOrOptions as { enabled?: boolean })?.enabled ?? true;
  }

  if (!enabled) {
    return null;
  }
  try {
    return factory() ?? null;
  } catch (error) {
    console.error('[safe-create-hook] Error creating hook:', error);
    return null;
  }
}
