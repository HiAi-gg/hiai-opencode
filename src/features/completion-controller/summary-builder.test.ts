import { describe, expect, test } from "bun:test"
import { buildSummary, parseClosureBlock } from "./summary-builder"

describe("summary-builder.parseClosureBlock", () => {
  test("parses accept readiness", () => {
    const c = parseClosureBlock(
      '<CLOSURE>{"reasoning":"done","evidence":["a"],"readiness":"accept"}</CLOSURE>',
    )
    expect(c?.readiness).toBe("accept")
    expect(c?.reasoning).toBe("done")
    expect(c?.evidence).toEqual(["a"])
  })

  test("parses done readiness", () => {
    const c = parseClosureBlock('<CLOSURE>{"readiness":"done","reasoning":"ok","evidence":[]}</CLOSURE>')
    expect(c?.readiness).toBe("done")
  })

  test("returns null on invalid input", () => {
    expect(parseClosureBlock("nothing")).toBeNull()
    expect(parseClosureBlock('<CLOSURE>{"readiness":"weird"}</CLOSURE>')).toBeNull()
  })
})

describe("summary-builder.buildSummary", () => {
  test("renders status + reasoning + evidence", () => {
    const md = buildSummary({
      closure: { readiness: "done", reasoning: "All tasks completed", evidence: ["lint pass", "tests pass"] },
      endpoints: [],
      remaining: [],
    })
    expect(md).toContain("## Bob Summary")
    expect(md).toContain("**Status:** completed")
    expect(md).toContain("All tasks completed")
    expect(md).toContain("lint pass")
    expect(md).toContain("tests pass")
  })

  test("renders endpoints table when present", () => {
    const md = buildSummary({
      closure: null,
      endpoints: [{ url: "http://localhost:3000", port: 3000, source: "bash" }],
      remaining: [],
    })
    expect(md).toContain("Open endpoints")
    expect(md).toContain("http://localhost:3000")
    expect(md).toContain("3000")
  })

  test("renders remaining items when present", () => {
    const md = buildSummary({
      closure: null,
      endpoints: [],
      remaining: ["fix tests", "review"],
    })
    expect(md).toContain("Remaining items")
    expect(md).toContain("fix tests")
  })

  test("handles empty input", () => {
    const md = buildSummary({ closure: null, endpoints: [], remaining: [] })
    expect(md).toContain("## Bob Summary")
    expect(md).toContain("**Status:** completed")
  })

  test("uses rejected title when readiness is reject", () => {
    const md = buildSummary({
      closure: { readiness: "reject", reasoning: "blocked", evidence: [] },
      endpoints: [],
      remaining: [],
    })
    expect(md).toContain("rejected")
    expect(md).toContain("**Status:** rejected")
  })
})
