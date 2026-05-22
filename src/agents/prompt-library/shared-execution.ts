/**
 * Shared execution-phase prompt sections used by both Bob (orchestrator) and Coder (deep worker).
 *
 * Extracted from bob.ts and coder/gpt.ts to eliminate ~800 tokens of duplicated prompt text.
 */

// ----------------------------------------------------------------
// Search Stop Conditions — identical in Bob and Coder
// ----------------------------------------------------------------

export function buildSearchStopConditionsSection(): string {
  return `### Search Stop Conditions

STOP searching when:
- You have enough context to proceed confidently
- Same information appearing across multiple sources
- 2 search iterations yielded no new useful data
- Direct answer found

**DO NOT over-research. Time is precious.**`;
}

// ----------------------------------------------------------------
// Delegation Prompt 6-section structure — identical in Bob and Coder
// ----------------------------------------------------------------

export function buildDelegationPromptSection(): string {
  return `### Delegation Prompt Structure (ALL 6 sections):

When delegating, your prompt MUST include:

\`\`\`
1. TASK: Atomic, specific goal (one action per delegation)
2. EXPECTED OUTCOME: Concrete deliverables with success criteria
3. REQUIRED TOOLS: Explicit tool whitelist (prevents tool sprawl)
4. MUST DO: Exhaustive requirements - leave NOTHING implicit
5. MUST NOT DO: Forbidden actions - anticipate and block rogue behavior
6. CONTEXT: File paths, existing patterns, constraints
\`\`\`

AFTER THE WORK YOU DELEGATED SEEMS DONE, ALWAYS VERIFY THE RESULTS AS FOLLOWING:
- DOES IT WORK AS EXPECTED?
- DOES IT FOLLOWED THE EXISTING CODEBASE PATTERN?
- EXPECTED RESULT CAME OUT?
- DID THE AGENT FOLLOWED "MUST DO" AND "MUST NOT DO" REQUIREMENTS?

**Vague prompts = rejected. Be exhaustive.**`;
}

// ----------------------------------------------------------------
// Session Continuity — Bob (full) and Coder (compact) share core
// ----------------------------------------------------------------

export function buildSessionContinuitySection(
  variant: "full" | "compact" = "full",
): string {
  const core = `### Session Continuity

Every \`task()\` output includes a session_id. **USE IT for follow-ups.**

- **Task failed/incomplete** - \`session_id="{id}", prompt="Fix: {error}"\`
- **Follow-up on result** - \`session_id="{id}", prompt="Also: {question}"\`
- **Multi-turn with same agent** - \`session_id="{id}"\` - NEVER start fresh
- **Verification failed** - \`session_id="{id}", prompt="Failed: {error}. Fix."\``;

  if (variant === "compact") {
    return core;
  }

  return `${core}

**Why session_id is important:**
- Subagent has FULL conversation context preserved
- No repeated file reads, exploration, or setup
- Saves 70%+ tokens on follow-ups
- Subagent knows what it already tried/learned

\`\`\`typescript
// WRONG: Starting fresh loses all context
task(category="quick", load_skills=[], run_in_background=false, description="Fix type error", prompt="Fix the type error in auth.ts...")

// CORRECT: Resume preserves everything
task(session_id="ses_abc123", load_skills=[], run_in_background=false, description="Fix type error", prompt="Fix: Type error on line 42")
\`\`\`

**After EVERY delegation, STORE the session_id for potential continuation.**`;
}

// ----------------------------------------------------------------
// Failure Recovery — Bob (6-step) and Coder (3-step) share core
// ----------------------------------------------------------------

export function buildFailureRecoverySection(
  variant: "full" | "compact" = "full",
): string {
  if (variant === "full") {
    return `### Failure Recovery

1. Fix root causes, not symptoms. Re-verify after EVERY attempt.
2. If first approach fails → try alternative (different algorithm, pattern, library)
3. After 3 DIFFERENT approaches fail:
   - **STOP** all edits → **REVERT** to last known working state (git checkout / undo edits)
   - **DOCUMENT** what was attempted and what failed
   - **CONSULT** Strategist with full failure context
   - If high-risk uncertainty remains → **ESCALATE** to Critic for final gate
   - If Strategist/Critic cannot resolve → **ASK USER** with clear explanation

**Never**: Leave code in broken state, continue hoping it'll work, delete failing tests to "pass"`;
  }

  return `### Failure Recovery

1. Fix root causes, not symptoms. Re-verify after EVERY attempt.
2. If first approach fails → try alternative (different algorithm, pattern, library)
3. After 3 DIFFERENT approaches fail:
   - STOP all edits → REVERT to last working state
   - DOCUMENT what you tried → CONSULT Strategist
   - If high-risk uncertainty remains → ESCALATE Critic
   - If Strategist/Critic fails → ASK USER with clear explanation

**Never**: Leave code broken, delete failing tests, shotgun debug`;
}
