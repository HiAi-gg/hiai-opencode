import { describe, expect, test } from 'bun:test';
import {
  BOB_DECODE_BOUNDARY,
  BOB_INTERNAL_CAVEMAN,
  DELEGATION_CAVEMAN,
  SUBAGENT_INTERNAL,
} from './caveman';

describe('caveman prompt fragments', () => {
  describe('BOB_INTERNAL_CAVEMAN', () => {
    test('contains Internal Communication Protocol header', () => {
      expect(BOB_INTERNAL_CAVEMAN).toContain('Internal Communication Protocol (Caveman)');
    });

    test('no template literal artifacts', () => {
      expect(BOB_INTERNAL_CAVEMAN).not.toMatch(/\$\{/);
    });

    test('contains no-filler rule', () => {
      expect(BOB_INTERNAL_CAVEMAN).toContain('No filler');
    });

    test('contains exact artifacts rule', () => {
      expect(BOB_INTERNAL_CAVEMAN).toContain('Exact artifacts');
    });

    test('contains CLOSURE always valid rule', () => {
      expect(BOB_INTERNAL_CAVEMAN).toContain('CLOSURE always valid');
    });
  });

  describe('BOB_DECODE_BOUNDARY', () => {
    test('contains Subagent Result Handoff Protocol header', () => {
      expect(BOB_DECODE_BOUNDARY).toContain('Subagent Result Handoff Protocol');
    });

    test('no template literal artifacts', () => {
      expect(BOB_DECODE_BOUNDARY).not.toMatch(/\$\{/);
    });

    test('mentions Result Envelope', () => {
      expect(BOB_DECODE_BOUNDARY).toContain('Result Envelope');
    });

    test('mentions Status/Summary/Evidence/Files touched labels', () => {
      expect(BOB_DECODE_BOUNDARY).toContain('**Status:**');
      expect(BOB_DECODE_BOUNDARY).toContain('**Summary:**');
      expect(BOB_DECODE_BOUNDARY).toContain('**Evidence:**');
      expect(BOB_DECODE_BOUNDARY).toContain('**Files touched:**');
    });

    test('requires parsing, consuming, synthesizing', () => {
      expect(BOB_DECODE_BOUNDARY).toContain('Parse');
      expect(BOB_DECODE_BOUNDARY).toContain('Consume');
      expect(BOB_DECODE_BOUNDARY).toContain('synthesize');
    });

    test('forbids leaking raw subagent output', () => {
      expect(BOB_DECODE_BOUNDARY).toContain('Never leak');
    });
  });

  describe('DELEGATION_CAVEMAN', () => {
    test('contains Result Envelope Protocol header', () => {
      expect(DELEGATION_CAVEMAN).toContain('Result Envelope Protocol');
    });

    test('no template literal artifacts', () => {
      expect(DELEGATION_CAVEMAN).not.toMatch(/\$\{/);
    });

    test('mentions Status/Summary/Deliverable/Evidence/Files touched', () => {
      expect(DELEGATION_CAVEMAN).toContain('**Status:**');
      expect(DELEGATION_CAVEMAN).toContain('**Summary:**');
      expect(DELEGATION_CAVEMAN).toContain('**Evidence:**');
      expect(DELEGATION_CAVEMAN).toContain('**Files touched:**');
    });

    test('mentions done/partial/failed/blocked status values', () => {
      expect(DELEGATION_CAVEMAN).toContain('done');
      expect(DELEGATION_CAVEMAN).toContain('partial');
      expect(DELEGATION_CAVEMAN).toContain('failed');
      expect(DELEGATION_CAVEMAN).toContain('blocked');
    });

    test('forbids raw Thinking/Reasoning between deliverable and CLOSURE', () => {
      expect(DELEGATION_CAVEMAN).toContain('No raw Thinking/Reasoning');
    });
  });

  describe('SUBAGENT_INTERNAL', () => {
    test('contains Result Envelope header', () => {
      expect(SUBAGENT_INTERNAL).toContain('Result Envelope');
    });

    test('no template literal artifacts', () => {
      expect(SUBAGENT_INTERNAL).not.toMatch(/\$\{/);
    });

    test('mentions Status/Summary/Deliverable/Evidence/Files touched labels', () => {
      expect(SUBAGENT_INTERNAL).toContain('**Status:**');
      expect(SUBAGENT_INTERNAL).toContain('**Summary:**');
      expect(SUBAGENT_INTERNAL).toContain('**Evidence:**');
      expect(SUBAGENT_INTERNAL).toContain('**Files touched:**');
    });

    test('mentions CLOSURE requirement', () => {
      expect(SUBAGENT_INTERNAL).toContain('CLOSURE');
    });

    test('forbids raw Thinking/Reasoning between deliverable and CLOSURE', () => {
      expect(SUBAGENT_INTERNAL).toContain('No raw Thinking/Reasoning');
    });
  });
});
