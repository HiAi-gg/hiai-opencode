import { createSystemDirective, SystemDirectiveTypes } from "../../shared/system-directive"
import { getAgentDisplayName } from "../../shared/agent-display-names"

export const HOOK_NAME = "strategist-md-only"

export const STRATEGIST_AGENT = "strategist"

export const ALLOWED_EXTENSIONS = [".md"]

export const ALLOWED_PATH_PREFIX = ".bob"

// ALL mutation-capable tools blocked for Strategist (planning-only agent)
// Strategist can ONLY write to .bob/*.md files via Write/Edit (with path check)
// ALL other file/system mutation tools are blocked unconditionally
export const BLOCKED_TOOLS = [
  "Write", "Edit", "write", "edit",
  "bash", "Bash",                        // shell commands (mutation risk)
  "apply_patch",                          // patch application
  "ast_grep_replace",                     // AST-based code replacement
  "hashline_edit",                        // hashline editing
  "interactive_bash",                     // interactive terminal
]

export const PLANNING_CONSULT_WARNING = `

---

${createSystemDirective(SystemDirectiveTypes.STRATEGIST_READ_ONLY)}

You are being invoked by ${getAgentDisplayName("strategist")}, a planning agent restricted to .bob/*.md plan files only.

**CRITICAL CONSTRAINTS:**
- DO NOT modify any files (no Write, Edit, or any file mutations)
- DO NOT execute commands that change system state
- DO NOT create, delete, or rename files
- ONLY provide analysis, recommendations, and information

**YOUR ROLE**: Provide consultation, research, and analysis to assist with planning.
Return your findings and recommendations. The actual implementation will be handled separately after planning is complete.

---

`

export const STRATEGIST_WORKFLOW_REMINDER = `

---

${createSystemDirective(SystemDirectiveTypes.STRATEGIST_READ_ONLY)}

## STRATEGIST MANDATORY WORKFLOW REMINDER

**You are writing a work plan. STOP AND VERIFY you completed ALL steps:**

┌─────────────────────────────────────────────────────────────────────┐
│                     STRATEGIST WORKFLOW                             │
├──────┬──────────────────────────────────────────────────────────────┤
│  1   │ INTERVIEW: Full consultation with user                       │
│      │    - Gather ALL requirements                                 │
│      │    - Clarify ambiguities                                     │
│      │    - Record decisions to .bob/drafts/                   │
├──────┼──────────────────────────────────────────────────────────────┤
│  2   │ PRE-PLAN CONSULTATION: Pre-generation gap analysis              │
│      │    - task(agent="Pre-Plan - Plan Consultant", ...)     │
│      │    - Identify missed questions, guardrails, assumptions      │
├──────┼──────────────────────────────────────────────────────────────┤
│  3   │ PLAN GENERATION: Write to .bob/plans/*.md               │
│      │    <- YOU ARE HERE                                           │
├──────┼──────────────────────────────────────────────────────────────┤
│  4   │ CRITIC REVIEW (if high accuracy requested)                    │
│      │    - task(agent="Critic - Plan Critic", ...)         │
│      │    - Loop until OKAY verdict                                 │
├──────┼──────────────────────────────────────────────────────────────┤
│  5   │ SUMMARY: Present to user                                     │
│      │    - Key decisions made                                      │
│      │    - Scope IN/OUT                                            │
│      │    - Offer: "Start Work" vs "High Accuracy Review"           │
│      │    - Guide to /start-work                                    │
└──────┴──────────────────────────────────────────────────────────────┘

**DID YOU COMPLETE STEPS 1-2 BEFORE WRITING THIS PLAN?**
**AFTER WRITING, WILL YOU DO STEPS 4-5?**

If you skipped steps, STOP NOW. Go back and complete them.

---

`
