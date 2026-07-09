import { describe, expect, test } from 'bun:test';
import { PLAN_PROMPT } from './plan';

describe('PLAN_PROMPT', () => {
  test('contains Result Delivery section', () => {
    expect(PLAN_PROMPT).toContain('Result Delivery');
  });

  test('contains Result Envelope format', () => {
    expect(PLAN_PROMPT).toContain('**Status:**');
    expect(PLAN_PROMPT).toContain('**Summary:**');
    expect(PLAN_PROMPT).toContain('**Evidence:**');
    expect(PLAN_PROMPT).toContain('**Files touched:**');
  });

  test('mentions done/partial/failed/blocked status values', () => {
    expect(PLAN_PROMPT).toContain('done');
    expect(PLAN_PROMPT).toContain('blocked');
    expect(PLAN_PROMPT).toContain('failed');
  });

  test('forbids raw Thinking/Reasoning between deliverable and CLOSURE', () => {
    expect(PLAN_PROMPT).toContain('No raw Thinking/Reasoning');
  });

  test('mentions Bob synthesizes for the user', () => {
    expect(PLAN_PROMPT).toContain('Bob synthesizes');
  });

  test('no template literal artifacts', () => {
    expect(PLAN_PROMPT).not.toMatch(/\$\{/);
  });

  // --- Phase/owner/parallel annotation tests ---

  test('contains Allowed Owner → Subagent Type Mapping section', () => {
    expect(PLAN_PROMPT).toContain('Allowed Owner');
    expect(PLAN_PROMPT).toContain('Subagent Type Mapping');
  });

  test('lists all valid owner→subagent_type mappings', () => {
    const owners = ['explore', 'plan', 'build', 'general', 'manager', 'critic', 'designer', 'writer', 'vision'];
    for (const owner of owners) {
      expect(PLAN_PROMPT).toContain(`\`${owner}\``);
    }
  });

  test('forbids owners not in the allowed list', () => {
    expect(PLAN_PROMPT).toContain('NEVER assign an owner not in this list');
  });

  test('mentions max 5 concurrent tasks per wave', () => {
    expect(PLAN_PROMPT).toContain('Max 5 concurrent');
  });

  test('requires plan file path in Evidence section', () => {
    expect(PLAN_PROMPT).toContain('plan file path');
  });

  test('requires full plan text in deliverable body', () => {
    expect(PLAN_PROMPT).toContain('ALWAYS include it here even if you also saved to .bob/plans/');
  });

  test('mentions PHASE-BASED EXECUTION GRAPH', () => {
    expect(PLAN_PROMPT).toContain('PHASE-BASED');
    expect(PLAN_PROMPT).toContain('EXECUTION GRAPH');
  });

  test('every step must state owner + parallel + deps + files + risk', () => {
    expect(PLAN_PROMPT).toContain('owner + parallel');
    expect(PLAN_PROMPT).toContain('deps + files + risk');
  });

  test('says Bob/Manager dispatch directly off annotations', () => {
    expect(PLAN_PROMPT).toContain('Bob/Manager dispatch');
  });
});
