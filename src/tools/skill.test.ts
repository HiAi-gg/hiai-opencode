import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createSkillTool } from './skill';

const skillsDir = join(import.meta.dir, '..', '..', 'skills');

// Minimal ToolContext — skill.ts does not read from it, but the tool()
// signature requires it.
const dummyContext = {
  sessionID: 'test-session',
  messageID: 'test-message',
  agent: 'test',
  directory: skillsDir,
  worktree: skillsDir,
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
} as unknown as Parameters<ReturnType<typeof createSkillTool>['execute']>[1];

const skillTool = createSkillTool(skillsDir);

async function runSkill(name: string): Promise<string> {
  const result = await skillTool.execute({ name } as never, dummyContext);
  return typeof result === 'string' ? result : result.output;
}

describe('skill tool — valid names', () => {
  test('resolves a namespaced skill name', async () => {
    const out = await runSkill('build/incremental-implementation');
    expect(out).toContain('Skill "build/incremental-implementation" loaded');
  });

  test('resolves a top-level group skill name', async () => {
    const out = await runSkill('build');
    expect(out).toContain('Skill "build" loaded');
  });

  test('resolves a plan namespaced skill name', async () => {
    const out = await runSkill('plan/interview-me');
    expect(out).toContain('Skill "plan/interview-me" loaded');
  });
});

describe('skill tool — path traversal safety', () => {
  test('rejects ".." traversal attempts', async () => {
    const out = await runSkill('../etc/passwd');
    expect(out).not.toContain('loaded');
    expect(out).toMatch(/not found|Invalid skill name/);
  });

  test('rejects ".." at the start of a name', async () => {
    const out = await runSkill('..');
    expect(out).not.toContain('loaded');
    expect(out).toMatch(/not found|Invalid skill name/);
  });

  test('rejects embedded ".." segments', async () => {
    const out = await runSkill('build/../../etc/passwd');
    expect(out).not.toContain('loaded');
    expect(out).toMatch(/not found|Invalid skill name/);
  });

  test('rejects absolute paths', async () => {
    const out = await runSkill('/etc/passwd');
    expect(out).not.toContain('loaded');
    expect(out).toMatch(/not found|Invalid skill name/);
  });

  test('rejects absolute path to a real file', async () => {
    const out = await runSkill('/etc/hosts');
    expect(out).not.toContain('loaded');
    expect(out).toMatch(/not found|Invalid skill name/);
  });
});

describe('skill tool — invalid name format', () => {
  test('rejects names with spaces', async () => {
    const out = await runSkill('build bad name');
    expect(out).toContain('Invalid skill name');
  });

  test('rejects names with special characters', async () => {
    const out = await runSkill('build@evil');
    expect(out).toContain('Invalid skill name');
  });
});

describe('skill tool — non-existent skills', () => {
  test('returns not-found for an unknown valid-format name', async () => {
    const out = await runSkill('build/does-not-exist');
    expect(out).toContain('not found');
    expect(out).not.toContain('loaded');
  });

  test('returns not-found for an unknown top-level name', async () => {
    const out = await runSkill('nonexistent-group');
    expect(out).toContain('not found');
    expect(out).not.toContain('loaded');
  });
});
