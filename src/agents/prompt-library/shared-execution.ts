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
STOP when: enough context, duplicate info across sources, 2 iterations yield nothing, direct answer found. Do NOT over-research.`;
}

// ----------------------------------------------------------------
// Delegation Prompt 6-section structure — identical in Bob and Coder
// ----------------------------------------------------------------

export function buildDelegationPromptSection(): string {
  return `### Delegation Prompt Structure (6 sections, ALL required)
1. TASK: atomic specific goal | 2. EXPECTED OUTCOME: concrete deliverables + success criteria | 3. REQUIRED TOOLS: explicit whitelist | 4. MUST DO: exhaustive requirements | 5. MUST NOT DO: forbidden actions | 6. CONTEXT: file paths + patterns + constraints
After delegation: verify (works? codebase pattern followed? expected result? MUST DO/NOT followed?). Vague prompts = rejected.`;
}

// ----------------------------------------------------------------
// Session Continuity — Bob (full) and Coder (compact) share core
// ----------------------------------------------------------------

export function buildSessionContinuitySection(
  variant: "full" | "compact" = "full",
): string {
  const core = `### Session Continuity
Every \`task()\` output includes session_id. USE IT for follow-ups. \`session_id="{id}", prompt="Fix: {error}"\` for failures; same id for multi-turn. NEVER start fresh.`;

  if (variant === "compact") {
    return core;
  }

  return `${core}
Subagent has full context preserved (saves 70%+ tokens on follow-ups). After EVERY delegation, STORE the session_id for continuation.`;
}

// ----------------------------------------------------------------
// Failure Recovery — Bob (full) and Coder (compact) share core
// ----------------------------------------------------------------

export function buildFailureRecoverySection(
  variant: "full" | "compact" = "full",
): string {
  if (variant === "full") {
    return `### Failure Recovery
1. Fix root causes (not symptoms). Re-verify after EVERY attempt.
2. If first approach fails → try alternative.
3. After 3 DIFFERENT approaches fail: STOP edits → REVERT (git checkout / undo) → DOCUMENT → CONSULT Strategist → ESCALATE Critic → ASK USER.
Never: leave code broken, shotgun debug, delete failing tests to "pass".`;
  }

  return `### Failure Recovery
1. Root causes, re-verify each attempt.
2. Try alternative on first failure.
3. After 3 fails: STOP → REVERT → DOCUMENT → CONSULT Strategist → ESCALATE Critic → ASK USER.
Never: leave broken, shotgun debug, delete tests.`;
}
