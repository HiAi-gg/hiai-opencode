import { createHash } from "node:crypto";

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

export function fingerprint(files: string[]): string {
  if (files.length === 0) return "";
  const uniq = [...new Set(files.map((f) => f.replace(/\\/g, "/")))].sort();
  return createHash("sha1").update(uniq.join("\n")).digest("hex");
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
