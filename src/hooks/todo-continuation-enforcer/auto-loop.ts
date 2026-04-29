import type { Todo } from "./types"

export type AutoLoopDecision =
  | { kind: "skip"; reason: string }
  | { kind: "start"; openTodos: number; goal: string }

export type AutoLoopInputs = {
  threshold: number | undefined
  todos: Todo[]
  alreadyStarted: boolean
  hasStartCallback: boolean
}

/**
 * Pure decision: should the enforcer auto-start ralph-loop right now?
 * Kept separate so it can be unit-tested without mocking the full plugin
 * context. The caller is responsible for actually invoking startRalphLoop
 * and updating session state.
 */
export function decideAutoLoop(input: AutoLoopInputs): AutoLoopDecision {
  if (!input.hasStartCallback) return { kind: "skip", reason: "no-start-callback" }
  if (!input.threshold || input.threshold < 1) return { kind: "skip", reason: "disabled" }
  if (input.alreadyStarted) return { kind: "skip", reason: "already-started" }

  const open = input.todos.filter(
    (todo) => todo.status !== "completed" && todo.status !== "cancelled",
  ).length
  if (open < input.threshold) {
    return { kind: "skip", reason: `below-threshold (${open}<${input.threshold})` }
  }

  return { kind: "start", openTodos: open, goal: buildAutoLoopGoal(open) }
}

export function buildAutoLoopGoal(openTodos: number): string {
  return [
    `Complete the remaining ${openTodos} todos in this session.`,
    ``,
    `DELEGATION IS MANDATORY for non-trivial todos:`,
    `- Codebase exploration / external docs → task(subagent_type="researcher", run_in_background=true, load_skills=[])`,
    `- Multi-step implementation or architecture choice → task(subagent_type="strategist", run_in_background=false, load_skills=[])`,
    `- Implementation work outside your direct context → task(subagent_type="coder", load_skills=[...])`,
    `- Review / debugging / verification → task(subagent_type="critic", run_in_background=false, load_skills=[])`,
    `Only do trivial todos (≤10 lines, single file, obvious change) yourself.`,
    ``,
    `Verify each todo before marking it done (build, tests, manual QA where applicable).`,
    `Emit <promise>DONE</promise> when ALL todos are completed and verified.`,
  ].join("\n")
}
