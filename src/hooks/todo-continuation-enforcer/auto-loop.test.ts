import { describe, expect, test } from "bun:test"
import { decideAutoLoop } from "./auto-loop"
import type { Todo } from "./types"

const todo = (status: string): Todo => ({ content: "x", status, priority: "medium" })

describe("decideAutoLoop", () => {
  test("skips when threshold is 0 or undefined", () => {
    const todos = Array.from({ length: 10 }, () => todo("pending"))
    expect(decideAutoLoop({ threshold: 0, todos, alreadyStarted: false, hasStartCallback: true }))
      .toEqual({ kind: "skip", reason: "disabled" })
    expect(decideAutoLoop({ threshold: undefined, todos, alreadyStarted: false, hasStartCallback: true }))
      .toEqual({ kind: "skip", reason: "disabled" })
  })

  test("skips when no startRalphLoop callback is wired", () => {
    const todos = Array.from({ length: 10 }, () => todo("pending"))
    const result = decideAutoLoop({ threshold: 5, todos, alreadyStarted: false, hasStartCallback: false })
    expect(result).toEqual({ kind: "skip", reason: "no-start-callback" })
  })

  test("skips when already auto-started in this session", () => {
    const todos = Array.from({ length: 10 }, () => todo("pending"))
    const result = decideAutoLoop({ threshold: 5, todos, alreadyStarted: true, hasStartCallback: true })
    expect(result).toEqual({ kind: "skip", reason: "already-started" })
  })

  test("skips when open todo count is below threshold", () => {
    const todos = [todo("pending"), todo("pending"), todo("pending"), todo("pending")]
    const result = decideAutoLoop({ threshold: 5, todos, alreadyStarted: false, hasStartCallback: true })
    expect(result.kind).toBe("skip")
    if (result.kind === "skip") expect(result.reason).toContain("below-threshold")
  })

  test("starts when open todo count meets threshold", () => {
    const todos = Array.from({ length: 5 }, () => todo("pending"))
    const result = decideAutoLoop({ threshold: 5, todos, alreadyStarted: false, hasStartCallback: true })
    expect(result.kind).toBe("start")
    if (result.kind === "start") {
      expect(result.openTodos).toBe(5)
      expect(result.goal).toContain("DELEGATION IS MANDATORY")
      expect(result.goal).toContain("<promise>DONE</promise>")
    }
  })

  test("does not count completed or cancelled todos as open", () => {
    const todos: Todo[] = [
      todo("completed"),
      todo("completed"),
      todo("cancelled"),
      todo("pending"),
      todo("pending"),
      todo("in_progress"),
    ]
    const result = decideAutoLoop({ threshold: 5, todos, alreadyStarted: false, hasStartCallback: true })
    expect(result.kind).toBe("skip")
    if (result.kind === "skip") expect(result.reason).toContain("below-threshold (3<5)")
  })

  test("treats in_progress todos as open", () => {
    const todos = Array.from({ length: 5 }, () => todo("in_progress"))
    const result = decideAutoLoop({ threshold: 5, todos, alreadyStarted: false, hasStartCallback: true })
    expect(result.kind).toBe("start")
  })

  test("goal mentions all four canonical specialist agents", () => {
    const todos = Array.from({ length: 5 }, () => todo("pending"))
    const result = decideAutoLoop({ threshold: 5, todos, alreadyStarted: false, hasStartCallback: true })
    if (result.kind !== "start") throw new Error("expected start")
    for (const agent of ["researcher", "strategist", "coder", "critic"]) {
      expect(result.goal).toContain(agent)
    }
  })
})
