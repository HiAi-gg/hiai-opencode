import { z } from "zod"

export const RalphLoopConfigSchema = z.object({
  enabled: z.boolean().default(false),
  default_max_iterations: z.number().min(1).max(1000).default(100),
  /** Custom state file directory relative to project root (default: .opencode/) */
  state_dir: z.string().optional(),
  default_strategy: z.enum(["reset", "continue"]).default("continue"),
  /**
   * Auto-start ralph-loop when the todo-continuation enforcer detects this many
   * (or more) open todos in a single session. 0 disables auto-start.
   *
   * When triggered, the loop runs in ultrawork mode so each iteration receives
   * the ULTRAWORK prompt that mandates delegation to specialist agents.
   */
  auto_start_threshold: z.number().min(0).max(100).default(0),
  /**
   * RESERVED (not yet implemented). When true, auto-started loops will first
   * open a strategist session to plan the remaining todos, then resume Bob
   * with the plan attached. Tracked as a follow-up; today auto-start uses
   * ulw mode in the existing session.
   */
  auto_start_with_strategist: z.boolean().default(false),
})

export type RalphLoopConfig = z.infer<typeof RalphLoopConfigSchema>
