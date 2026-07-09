import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tool } from '@opencode-ai/plugin';

function discoverSkills(skillsDir: string): Map<string, string> {
  const index = new Map<string, string>();

  function walk(dir: string, parents: string[]) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, [...parents, entry.name]);
        } else if (entry.name === 'SKILL.md') {
          const namespacedName = parents.join('/');
          if (namespacedName && !index.has(namespacedName)) {
            index.set(namespacedName, fullPath);
          }
          const shortName = parents[parents.length - 1];
          if (shortName && !index.has(shortName)) {
            index.set(shortName, fullPath);
          }
        }
      }
    } catch {
      // Ignore permission/errors
    }
  }

  walk(skillsDir, []);
  return index;
}

function normalizeSkillName(
  name: string,
  skillsDir: string,
  skillIndex: Map<string, string>,
): string | null {
  if (name.includes('..') || name.startsWith('/')) return null;

  if (skillIndex.has(name)) {
    const path = skillIndex.get(name) ?? '';
    if (!path.startsWith(skillsDir)) return null;
    return path;
  }

  if (name.includes('/')) {
    const directPath = join(skillsDir, name, 'SKILL.md');
    if (existsSync(directPath)) {
      skillIndex.set(name, directPath);
      return directPath;
    }
  }

  return null;
}

export function createSkillTool(skillsDir: string) {
  let skillIndex: Map<string, string> | null = null;

  function getIndex(): Map<string, string> {
    if (!skillIndex) {
      skillIndex = discoverSkills(skillsDir);
    }
    return skillIndex;
  }

  return tool({
    description:
      'Load and invoke a registered skill by name. Use namespaced names like `build/shadcn-ui`, `plan/interview-me`, `explore/context7`, or top-level group names like `build`, `plan`, `writer`.',
    args: {
      name: tool.schema
        .string()
        .describe(
          'Skill name to invoke — e.g., `build/incremental-implementation`, `plan/interview-me`, `explore/context7`, `writer`, `systematic-debugging`',
        ),
      args: tool.schema.string().optional().describe('Arguments to pass to the skill'),
    },
    async execute(input) {
      const nameRegex = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/;
      if (!nameRegex.test(input.name)) {
        const available = listAllSkills(getIndex());
        return `Invalid skill name "${input.name}". Use namespaced names like "build/shadcn-ui" or top-level group names.

Available skills:
${available}`;
      }

      const index = getIndex();
      const resolvedPath = normalizeSkillName(input.name, skillsDir, index);

      if (!resolvedPath || !existsSync(resolvedPath)) {
        const available = listAllSkills(index);
        return `Skill "${input.name}" not found.

Available skills (${index.size} total):
${available}`;
      }

      try {
        const content = readFileSync(resolvedPath, 'utf-8');
        return `Skill "${input.name}" loaded:\n\n${content}`;
      } catch (err) {
        return `Failed to read skill "${input.name}": ${
          err instanceof Error ? err.message : String(err)
        }`;
      }
    },
  });
}

function listAllSkills(index: Map<string, string>): string {
  const names = [...index.keys()].sort();
  return names.join('\n');
}
