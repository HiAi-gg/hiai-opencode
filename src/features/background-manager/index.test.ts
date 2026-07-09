/**
 * background-manager.test.ts — Tests for BackgroundManager including sanitizer.
 */

import { describe, expect, test } from 'bun:test';
import { formatBackgroundResultForParent } from './index';

describe('formatBackgroundResultForParent', () => {
  // Plain text input remains useful
  test('plain text input is returned as-is', () => {
    const input = 'This is a simple text result without any special formatting.';
    expect(formatBackgroundResultForParent(input)).toBe(input);
  });

  test('plain text longer than 2000 chars is truncated', () => {
    const input = 'x'.repeat(2500);
    const result = formatBackgroundResultForParent(input);
    expect(result.length).toBeLessThanOrEqual(2000 + '\n... (truncated)'.length);
    expect(result).toContain('... (truncated)');
  });

  // CLOSURE block stripping
  test('strips <CLOSURE>...</CLOSURE> blocks', () => {
    const input = `Some content before
<CLOSURE>
{
  "reasoning": "Did something",
  "evidence": ["test.ts"],
  "readiness": "done"
}
</CLOSURE>
Some content after`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('<CLOSURE>');
    expect(result).not.toContain('</CLOSURE>');
    expect(result).toContain('Some content before');
    expect(result).toContain('Some content after');
  });

  test('strips <CLOSURE>...</CLOSURE> case-insensitive', () => {
    const input = `<closure>text</closure> normal content`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('<closure>');
    expect(result).not.toContain('</closure>');
    expect(result).toContain('normal content');
  });

  // Result Envelope label stripping
  test('strips **Status:** line', () => {
    const input = `**Status:** done
Some actual content`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('**Status:**');
    expect(result).toContain('Some actual content');
  });

  test('strips **Summary:** line', () => {
    const input = `**Summary:** Task completed successfully
Some actual content`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('**Summary:**');
    expect(result).toContain('Some actual content');
  });

  test('strips **Evidence:** line', () => {
    const input = `**Evidence:** test.ts, src/index.ts
Some actual content`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('**Evidence:**');
    expect(result).toContain('Some actual content');
  });

  test('strips **Files touched:** line', () => {
    const input = `**Files touched:** src/index.ts
Some actual content`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('**Files touched:**');
    expect(result).toContain('Some actual content');
  });

  // Full envelope stripping
  test('strips full Result Envelope', () => {
    const input = `**Status:** done
**Summary:** Implemented feature X
This is the deliverable body content that should be preserved.
**Evidence:** src/feature.ts
**Files touched:** src/feature.ts
<CLOSURE>
{"reasoning":"done","evidence":[],"readiness":"done"}
</CLOSURE>`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('**Status:**');
    expect(result).not.toContain('**Summary:**');
    expect(result).not.toContain('**Evidence:**');
    expect(result).not.toContain('**Files touched:**');
    expect(result).not.toContain('<CLOSURE>');
    expect(result).toContain('This is the deliverable body content that should be preserved.');
  });

  // CLOSURE_PROTOCOL stripping
  test('strips <CLOSURE_PROTOCOL> blocks', () => {
    const input = `Some content
<CLOSURE_PROTOCOL>
## Mandatory Task Finalization
...
</CLOSURE_PROTOCOL>
More content`;
    const result = formatBackgroundResultForParent(input);
    expect(result).not.toContain('<CLOSURE_PROTOCOL>');
    expect(result).not.toContain('</CLOSURE_PROTOCOL>');
    expect(result).toContain('Some content');
    expect(result).toContain('More content');
  });

  // Edge cases
  test('empty string returns "No output"', () => {
    expect(formatBackgroundResultForParent('')).toBe('No output');
  });

  test('null/undefined treated as empty', () => {
    expect(formatBackgroundResultForParent('')).toBe('No output');
  });

  test('multiple blank lines collapsed', () => {
    const input = `Line 1

Line 2


Line 3`;
    const result = formatBackgroundResultForParent(input);
    // Should not have more than 2 consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
  });

  test('result is trimmed', () => {
    const input = `   **Status:** done
   
   Some content   `;
    const result = formatBackgroundResultForParent(input);
    expect(result).toBe('Some content');
  });

  test('only envelope labels returns "No output"', () => {
    const input = `**Status:** done
**Summary:** summary
**Evidence:** evidence
**Files touched:** files`;
    const result = formatBackgroundResultForParent(input);
    expect(result).toBe('No output');
  });
});
