/**
 * Extract sessionID from event properties.
 *
 * Handles two common OpenCode event shapes:
 * - `props.sessionID` (direct field)
 * - `props.info.id` (nested in info object)
 */
export function extractSessionID(props: unknown): string | undefined {
  const p = props as Record<string, unknown> | undefined;
  if (!p) return undefined;
  const info = p.info as Record<string, unknown> | undefined;
  return (
    (p.sessionID as string | undefined) ?? (info?.id as string | undefined)
  );
}
