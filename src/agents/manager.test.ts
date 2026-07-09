import { describe, expect, test } from 'bun:test';
import { MANAGER_PROMPT } from './manager';

describe('MANAGER_PROMPT', () => {
  test('contains Input Contract section', () => {
    expect(MANAGER_PROMPT).toContain('Input Contract');
    expect(MANAGER_PROMPT).toContain('Execution Graph Extract');
  });

  test('mentions receiving plan text from Bob', () => {
    expect(MANAGER_PROMPT).toContain('Raw plan text');
    expect(MANAGER_PROMPT).toContain('Execution Graph Extract');
  });

  test('contains Routing Gate with owner→subagent_type mapping', () => {
    expect(MANAGER_PROMPT).toContain('Routing Gate');
    expect(MANAGER_PROMPT).toContain('Owner → Subagent Type Mapping');
  });

  test('lists all valid owner→subagent_type mappings', () => {
    const mappings = [
      'explore',
      'plan',
      'build',
      'general',
      'manager',
      'critic',
      'designer',
      'writer',
      'vision',
    ];
    for (const agent of mappings) {
      expect(MANAGER_PROMPT).toContain(`\`${agent}\``);
    }
  });

  test('instructs not to override plan owner assignment', () => {
    expect(MANAGER_PROMPT).toContain('Do NOT override the plan\'s owner assignment');
  });

  test('contains phase-based dispatch rules', () => {
    expect(MANAGER_PROMPT).toContain('Phase-Based Parallel Dispatch');
    expect(MANAGER_PROMPT).toContain('concurrent task() calls');
  });

  test('mentions collecting all results before next phase', () => {
    expect(MANAGER_PROMPT).toContain('Collect ALL results');
  });

  test('mentions max 5 concurrent dispatches', () => {
    expect(MANAGER_PROMPT).toContain('up to 5 at once');
  });

  test('serializes parallel: no and overlapping file steps', () => {
    expect(MANAGER_PROMPT).toContain('file overlap');
  });

  test('instructs to use task() not actor() for delegation', () => {
    expect(MANAGER_PROMPT).toContain('Use `task()`');
    expect(MANAGER_PROMPT).not.toContain('Use `actor()');
  });

  test('contains Dispatch Process section', () => {
    expect(MANAGER_PROMPT).toContain('Dispatch Process');
    expect(MANAGER_PROMPT).toContain('Execution Graph Driven');
  });

  test('no template literal artifacts', () => {
    expect(MANAGER_PROMPT).not.toMatch(/\$\{/);
  });

  test('has CRITICAL CONSTRAINTS block that forbids direct implementation', () => {
    expect(MANAGER_PROMPT).toContain('## CRITICAL CONSTRAINTS');
    expect(MANAGER_PROMPT).toContain('You NEVER execute write');
    expect(MANAGER_PROMPT).toContain('You NEVER write code directly');
    expect(MANAGER_PROMPT).toContain('return BLOCKED status');
  });

  test('no stale actor() references in delegation examples', () => {
    // The delegation syntax section should use task() not actor()
    const delegationSection = MANAGER_PROMPT.match(/## Delegation Syntax[\s\S]*?## CRITICAL CONSTRAINTS/)?.[0]
      ?? MANAGER_PROMPT.match(/## Delegation Syntax[\s\S]*?## Output Format/)?.[0]
      ?? '';
    expect(delegationSection).not.toContain('actor(');
    expect(delegationSection).toContain('task(');
  });
});
