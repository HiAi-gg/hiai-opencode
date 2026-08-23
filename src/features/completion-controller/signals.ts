export function matchesAnyGlob(path: string, globs: string[]): boolean {
  const norm = path.replace(/\\/g, "/");
  return globs.some((g) => globToRegExp(g).test(norm));
}

function globToRegExp(glob: string): RegExp {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .split(/(?:\*\*)/)
    .map((segment) => segment.replace(/\*/g, "[^/]*"))
    .join(".*");
  return new RegExp(`^${re}$`);
}

export function parseCriticVerdict(
  text: string,
): "approved" | "rejected" | null {
  const m = text.match(/<CLOSURE>([\s\S]*?)<\/CLOSURE>/i);
  if (!m) return null;
  const body = m[1];
  if (/["']readiness["']\s*:\s*["']accept["']/i.test(body)) return "approved";
  if (/["']readiness["']\s*:\s*["']reject["']/i.test(body)) return "rejected";
  return null;
}
