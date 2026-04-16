import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface SkillDefinition {
  name: string;
  description: string;
  content: string;
}

export function loadBundledSkills(skillsDir: string, disabled: string[] = []): SkillDefinition[] {
  if (!existsSync(skillsDir)) return [];

  const skills: SkillDefinition[] = [];
  const entries = readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (disabled.includes(entry.name)) continue;

    const skillPath = join(skillsDir, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, "utf-8");
    const { name, description } = parseFrontmatter(content);

    skills.push({
      name: name || entry.name,
      description: description || "",
      content,
    });
  }

  return skills;
}

function parseFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }

  return { name: fm.name, description: fm.description };
}

export function buildSkillPaths(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(skillsDir, e.name));
}
