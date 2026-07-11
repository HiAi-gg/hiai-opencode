import { describe, expect, test } from "bun:test";
import { WRITER_PROMPT } from "./writer";

describe("WRITER_PROMPT", () => {
  test("contains Content Strategist identity", () => {
    expect(WRITER_PROMPT).toContain("Content Strategist");
  });

  test("contains Discovery First rule", () => {
    expect(WRITER_PROMPT).toContain("Discovery First");
    expect(WRITER_PROMPT).toContain("native memory");
  });

  test("contains anti-hype words list", () => {
    expect(WRITER_PROMPT).toContain("seamless");
    expect(WRITER_PROMPT).toContain("powerful");
    expect(WRITER_PROMPT).toContain("revolutionary");
    expect(WRITER_PROMPT).toContain("supercharge");
  });

  test("contains file scope restriction", () => {
    expect(WRITER_PROMPT).toContain("*.md");
    expect(WRITER_PROMPT).toContain("*.mdx");
    expect(WRITER_PROMPT).toContain("locale JSON");
  });

  test("contains output contract structure", () => {
    expect(WRITER_PROMPT).toContain("direction");
    expect(WRITER_PROMPT).toContain("rationale");
    expect(WRITER_PROMPT).toContain("final_copy");
    expect(WRITER_PROMPT).toContain("alternates");
    expect(WRITER_PROMPT).toContain("seo");
  });

  test("contains writing principles", () => {
    expect(WRITER_PROMPT).toContain("**Clarity**");
    expect(WRITER_PROMPT).toContain("**Conciseness**");
    expect(WRITER_PROMPT).toContain("**User-focused**");
    expect(WRITER_PROMPT).toContain("**Consistent**");
  });

  test("contains delegation to explore", () => {
    expect(WRITER_PROMPT).toContain("explore");
  });

  test("contains Result Envelope format", () => {
    expect(WRITER_PROMPT).toContain("**Status:**");
    expect(WRITER_PROMPT).toContain("**Summary:**");
    expect(WRITER_PROMPT).toContain("**Files touched:**");
  });

  test("contains CLOSURE schema", () => {
    expect(WRITER_PROMPT).toContain("<CLOSURE>");
    expect(WRITER_PROMPT).toContain("readiness");
  });

  test("explicitly says Writer focuses on words", () => {
    expect(WRITER_PROMPT).toContain("write copy, not code");
    expect(WRITER_PROMPT).toContain("words, not visuals");
  });

  test("references context7 for library docs", () => {
    expect(WRITER_PROMPT).toContain("context7");
  });

  test("no caveman compression is explicitly stated", () => {
    expect(WRITER_PROMPT).toContain("NOT caveman-compressed");
  });

  test("contains Peer Coordination with Designer", () => {
    expect(WRITER_PROMPT).toContain("Designer");
  });
});
