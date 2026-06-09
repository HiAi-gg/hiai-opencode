export interface MemPalaceAutoSaveState {
  lastSaveAt?: number;
  savedTodos: Set<string>; // todo IDs already saved
  sessionEndSaved: boolean;
}

export interface MemPalaceAutoSaveOptions {
  /**
   * Minimum interval between auto-saves in milliseconds.
   * Defaults to 60 seconds.
   */
  debounceMs?: number;
  /**
   * Whether the hook is enabled. Defaults to true.
   */
  enabled?: boolean;
}
