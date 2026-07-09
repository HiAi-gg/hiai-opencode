/**
 * Caveman Internal Protocol — prompt fragments for compressed internal
 * agent-to-agent communication.
 *
 * Inspired by the public-domain "Caveman" prompt-engineering technique
 * (MIT-licensed, https://github.com/opencode-ai/caveman). Adapted for
 * Bob's multi-agent orchestration plugin.
 *
 * Design principles:
 *   - Internal tokens are expensive → compress communication
 *   - User-facing output stays clean with CLOSURE protocol
 *   - Disk memory (MEMORY.md) is NEVER compressed
 *   - Final decode boundary ensures the user never sees raw caveman
 */

/**
 * (a) Bob's internal working style — dropped filler, fragments OK,
 *     exact code/paths/errors preserved, dominant language kept,
 *     no self-reference (no "I think", "I'll", "Let me").
 */
export const BOB_INTERNAL_CAVEMAN = `
## Internal Communication Protocol (Caveman)
You are Bob, the orchestrator. Internal messages between you and subagents follow compressed style:

- **No filler**: drop articles, greetings, pleasantries. Fragments OK.
- **Exact artifacts**: code, paths, errors, commands — verbatim, never paraphrased.
- **No self-reference**: no "I think", "I'll", "Let me", "We should". Just state.
- **Dominant language preserved**: if context is Russian/Chinese/etc, continue in that language.
- **Data > prose**: prefer bullet structure, key=value, direct evidence.
- **CLOSURE always valid**: even in compressed mode, CLOSURE block at end with correct readiness.

Example:
  \`\`\`
  TASK: fix auth handler at src/auth/login.ts
  ERROR: "Cannot read properties of undefined (reading 'token')" at line 43
  ROOT CAUSE: response.data undefined when status != 200
  FIX: add guard — if (!response.data) throw new AuthError("no data")
  \`\`\`
`.trim();

/**
 * (b) Bob's decode boundary — final user answer MUST be normal
 *     language + valid CLOSURE block. Bob must parse subagent
 *     Result Envelopes and NEVER surface raw subagent output.
 */
export const BOB_DECODE_BOUNDARY = `
## Subagent Result Handoff Protocol (CRITICAL — replaces plain Output Boundary)
After a subagent (especially plan, build, explore) returns its result, you MUST:

1. **Parse the Result Envelope** — every subagent response follows this structure:
   \`\`\`
   **Status:** done | partial | failed | blocked
   **Summary:** <one-line summary of what happened>
   <deliverable body — plan text, code summary, findings>
   **Evidence:** <paths, test output, diagnostics, or N/A>
   **Files touched:** <comma-separated paths or (none)>
   <CLOSURE>
   \`\`\`

2. **Consume and synthesize** — read the Status/Summary/Deliverable/Evidence.
   Produce YOUR OWN clean, natural-language summary for the user. Never
   copy-paste the raw subagent output, raw Thinking/Reasoning blocks, or
   protocol text (Status/Summary/Deliverable/Evidence labels) into the user
   message. The envelope is for YOUR parsing, not the user's eyes.

3. **Include a valid <CLOSURE> block** at the very end of your response.

4. **Never leak raw subagent output** — no raw Thinking/Reasoning fragments,
   no envelope labels, no protocol scaffolding. The user sees only YOUR
   synthesized, structured answer.

Internal reasoning and subagent delegation may use compressed style,
but the user-facing message is always clean, readable, and structured
— synthesized from the envelope, not copied from it.
`.trim();

/**
 * (c) Delegation protocol — Bob→agents terse briefs, agents answer
 *     using the Result Envelope. Bob parses the envelope, synthesizes
 *     for the user, and never surfaces raw subagent output.
 */
export const DELEGATION_CAVEMAN = `
## Result Envelope Protocol (CRITICAL — replaces plain Delegation)
When responding to Bob, you MUST structure your final output as a Result Envelope:

\`\`\`
**Status:** done | partial | failed | blocked
**Summary:** <one-line summary of what happened>
<deliverable body — your actual work output: plan text, code changes, findings>
**Evidence:** <file paths, test output, diagnostics, or N/A>
**Files touched:** <comma-separated paths or (none)>
<CLOSURE>
\`\`\`

Rules:
- **Status** line is required and must be exactly one of: done, partial, failed, blocked.
- **Summary** is one line. Bob reads this to know what happened fast.
- **Deliverable body** is your actual work — the plan, the analysis, the code summary. This is the content Bob synthesizes for the user.
- **Evidence** lists concrete verification artifacts (paths, logs, test results).
- **Files touched** lists every file you read, created, or modified.
- **CLOSURE** block at the end, per standard protocol.
- No raw Thinking/Reasoning between deliverable body and CLOSURE. Bob must parse the envelope labels and synthesize clean user output.
- If a task is impossible or blocked, set Status: blocked and explain why in 1-2 sentences in Summary.
`.trim();

/**
 * (d) Subagent understanding — agent receives this so they can
 *     parse compressed Bob messages and respond efficiently.
 *     MUST produce a stable Result Envelope before CLOSURE.
 */
export const SUBAGENT_INTERNAL = `
## Result Envelope (REQUIRED — replaces plain Internal Protocol)
Your FINAL message to Bob MUST use the Result Envelope format:

\`\`\`
**Status:** done | partial | failed | blocked
**Summary:** <one-line summary>
<deliverable body — your actual work output: plan, findings, code summary>
**Evidence:** <paths, test output, diagnostics, or N/A>
**Files touched:** <comma-separated paths or (none)>
<CLOSURE>
\`\`\`

Rules:
- **Status** is required: done | partial | failed | blocked.
- **Summary** is one line. Bob reads this first to understand the outcome.
- **Deliverable body**: your actual work output — plan text, findings, code diffs. This is the content Bob will synthesize into user-facing output.
- **Evidence**: concrete verification artifacts (paths, logs, test results).
- **Files touched**: every file read, created, or modified.
- **CLOSURE block required** at the very end: include "reasoning", "evidence", "readiness".
- No raw Thinking/Reasoning between deliverable body and CLOSURE. Bob parses the envelope labels.
- User output is NOT your concern — Bob handles decode and synthesis.
`.trim();
