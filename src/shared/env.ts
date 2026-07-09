export function resolveEnvVars<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\{env:([^}]+)\}/g, (_, varName) => process.env[varName] ?? '') as T;
  }
  if (Array.isArray(value)) return value.map((v) => resolveEnvVars(v)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveEnvVars(v)]),
    ) as T;
  }
  return value;
}
