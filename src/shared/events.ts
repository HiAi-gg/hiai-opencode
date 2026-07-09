export function isSessionIdleEvent(
  e: unknown,
): e is { type: string; properties?: { sessionID?: string } } {
  return typeof e === "object" && e !== null && "type" in e;
}
