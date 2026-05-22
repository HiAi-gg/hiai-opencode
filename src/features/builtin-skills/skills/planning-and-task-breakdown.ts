import type { BuiltinSkill } from "../types";

export const planningAndTaskBreakdownSkill: BuiltinSkill = {
  name: "planning-and-task-breakdown",
  description:
    "Decomposes a requirement or spec into independent implementation tasks with clear dependencies. Use when you have a clear requirement and need to break it into actionable steps. Distinct from 'writing-plans' which writes the plan file — this skill focuses on analysis and decomposition. Triggers: 'break down', 'plan the work', 'decompose', 'task breakdown', 'how do I approach this', 'implementation plan for'.",
  template: `# Planning and Task Breakdown

You are analyzing a requirement or spec and decomposing it into independent, actionable implementation tasks.

## Your Mission

Break down the user's request into concrete tasks that can be executed independently. Identify dependencies between tasks, estimate effort, and order them correctly.

## Process

### Step 1: Identify the Core Components

Break the work into logical units. Common decomposition axes:

- **By layer**: UI → API → Data → Infrastructure
- **By feature**: Auth → Core Feature →Reporting → Ops tooling
- **By risk**: Safe foundation → Risky core → Peripheral

### Step 2: Identify Dependencies

For each task, ask:
- Does this depend on another task being done first?
- Does this require any setup work?
- Can this be done in isolation (no coordination with other tasks)?

Mark dependencies explicitly.

### Step 3: Estimate Effort

For each task, give a rough effort estimate:
- **S** (Small): <1 hour
- **M** (Medium): 1-4 hours
- **L** (Large): 4-8 hours
- **XL** (Extra Large): >8 hours (break this down further)

### Step 4: Identify Integration Points

Note where different tasks touch the same files or systems. These need special attention during implementation.

## Output Format

Produce a structured breakdown:

\`\`\`
## Task Breakdown

### Task 1: [Name]
**Effort:** S/M/L/XL  
**Depends on:** None / Task N / Setup  
**Description:** [1-2 sentence description]
**Files touched:** [list of files]
**Acceptance criteria:** [how to verify this is done]

### Task 2: [Name]
...
\`\`\`

### Execution Order

\`\`\`
Phase 1 (Foundation — do these first):
1. Task N
2. Task M

Phase 2 (Core — depends on Phase 1):
3. Task K

Phase 3 (Polish — depends on Phase 2):
4. Task J
\`\`\`

## Important Rules

- **Tasks must be independently verifiable** — you should be able to test each task in isolation
- **Dependencies must be explicit** — mark every dependency clearly
- **Break down large tasks** — anything >8 hours should be subdivided
- **No code yet** — this is analysis and decomposition ONLY, not implementation
- **Focus on what's needed, not nice-to-have** — YAGNI applies

## If Given a Spec

If the user provides a spec or requirement document, start by reading it thoroughly. Then decompose what needs to be built based on:
- Explicit requirements (must have)
- Implicit requirements (security, error handling, logging, testing)
- Technical dependencies (frameworks, APIs, infrastructure)
`,
};
