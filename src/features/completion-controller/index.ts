import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { BobConfig } from "../../types";
import { decide } from "./decide";
import { matchesAnyGlob, parseCriticVerdict } from "./signals";
import * as st from "./state";
import { logger } from "../../util/log";

/** LSP tool names that satisfy the post-edit lsp_diagnostics requirement. */
const LSP_TOOL_NAMES = new Set([
  "lsp_diagnostics",
  "lsp_goto_definition",
  "lsp_find_references",
  "lsp_symbols",
]);

let client: PluginInput["client"] | null = null;

/**
 * Maximum length (chars) allowed in a TUI-visible `output.reason`. Reasons are
 * surfaced as clickable links in the OpenCode TUI; an oversized or raw payload
 * (full session transcript, stack trace, internal IDs) must never be leaked
 * there. Anything longer is truncated to a safe summary.
 */
const MAX_REASON_LEN = 240;

/**
 * Patterns that reveal internal/runtime detail we must never surface in a TUI
 * link: stack frames, file paths with line/col, hex/sha IDs, session IDs,
 * absolute paths, and raw "at <fn>" frames.
 */
const INTERNAL_LEAK_PATTERNS: RegExp[] = [
  /\bat\s+[A-Za-z0-9_$.]+\s*\(/g, // "at foo (file:line:col)"
  /\bfile:\/\/\S+/gi, // file:// URLs
  /\/[\w./-]+\.(ts|tsx|js|jsx|mjs|cjs):\d+/g, // /path/file.ts:12
  /\b[0-9a-f]{16,}\b/gi, // long hex (sha1, session ids, trace ids)
  /\bsession[_-]?id\b[=:]\s*\S+/gi, // sessionID=... / session_id: ...
  /\b[a-z0-9]{20,}\b/gi, // long opaque tokens/ids
];

/**
 * Sanitize a `reason` string before it is written to `output.reason`.
 *
 * The completion controller's `action.prompt` is a controlled, human-readable
 * instruction ("Continue with the remaining TODO items…"). However the value
 * can be concatenated with diagnostic context, or a future branch could pass a
 * raw payload. This guard:
 *   - strips internal stack frames / file paths / hex IDs / session IDs,
 *   - collapses whitespace,
 *   - truncates to MAX_REASON_LEN with an explicit "…" marker.
 *
 * It never throws — on any unexpected input it returns a safe constant so the
 * TUI link can never carry a leaked payload.
 */
export function sanitizeReason(raw: string | undefined | null): string {
  if (!raw) return "";
  let s: string;
  try {
    if (typeof raw !== "string") return "";
    s = raw;
  } catch {
    return "";
  }
  for (const re of INTERNAL_LEAK_PATTERNS) {
    s = s.replace(re, " ");
  }
  // Collapse runs of whitespace (incl. newlines) into a single space.
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > MAX_REASON_LEN) {
    s = `${s.slice(0, MAX_REASON_LEN).trimEnd()}…`;
  }
  return s;
}

// Local type — @opencode-ai/plugin doesn't export this
// The runtime actor.postStop hook is registered as an object with matcher+run,
// not as a raw function — see the registration object at line ~207.
type _ActorPostStopRegistration = {
  matcher: { mode: string };
  run: (
    input: {
      sessionID: string;
      agentType: string;
      parentSessionID?: string;
    },
    output: {
      continue?: boolean;
      reason?: string;
    },
  ) => Promise<void>;
};

export function setCompletionClient(c: PluginInput["client"]) {
  client = c;
}

export function createBobCompletionHook(
  config: BobConfig,
): Pick<Hooks, "tool.execute.after" | "event" | "chat.message"> &
  Record<string, unknown> {
  const cfg = config.completion ?? {
    enabled: true,
    max_auto_continues: 25,
    require_critic: true,
    ui_globs: [],
    reset_on_user_message: true,
  };
  if (!cfg.enabled) return {};

  async function readLastAssistantVerdict(
    sessionID: string,
  ): Promise<"approved" | "rejected" | null> {
    if (!client) return null;
    try {
      const res = await client.session.messages({ path: { id: sessionID } });
      const msgs = (res.data ?? []) as Array<{
        info?: { role?: string };
        parts?: Array<{ type?: string; text?: string }>;
      }>;
      const lastAssistant = [...msgs]
        .reverse()
        .find((m) => m.info?.role === "assistant");
      const text = (lastAssistant?.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
      return parseCriticVerdict(text);
    } catch {
      return null;
    }
  }

  return {
    "tool.execute.after": async (input, _output) => {
      const sid = input.sessionID;
      if (!sid) return;
      // An LSP tool call satisfies the post-edit diagnostics requirement.
      if (LSP_TOOL_NAMES.has(input.tool)) {
        st.setLspPending(sid, false);
        return;
      }
      if (
        input.tool !== "write" &&
        input.tool !== "edit" &&
        input.tool !== "apply_patch"
      )
        return;
      const args = (input.args as Record<string, unknown> | undefined) ?? {};
      const fp = (args.filePath ?? args.path) as string | undefined;
      if (!fp) return;
      st.recordChangedFile(sid, fp, matchesAnyGlob(fp, cfg.ui_globs));
    },

    // Detect when the user sends a new message and reset the auto-continue
    // loop counter. The chat.message hook fires for every message enqueued
    // to the LLM. When the user sends a message, sessionID is the main
    // session (correctly resetting the root orchestrator's state). When a
    // subagent auto-continues, sessionID is the subagent's session, which
    // is harmless (subagent state is not used for decide()).
    "chat.message": async (input, _output) => {
      if (cfg.reset_on_user_message && input.sessionID) {
        st.resetForUser(input.sessionID);
      }
    },

    // Listen for todo updates to feed hasIncompleteTodos into the decision
    // state machine, so decide() knows whether there is still work to do.
    event: async (input) => {
      const evt = input.event as
        | {
            type: string;
            properties: { sessionID: string; todos: Array<{ status: string }> };
          }
        | undefined;
      if (evt?.type === "todo.updated" && evt.properties) {
        const hasIncomplete = evt.properties.todos.some(
          (t) => t.status !== "completed" && t.status !== "cancelled",
        );
        st.setHasIncompleteTodos(evt.properties.sessionID, hasIncomplete);
      }
    },

    "actor.postStop": {
      matcher: { mode: "peer" },
      run: async (
        input: {
          sessionID: string;
          agentType: string;
          parentSessionID?: string;
        },
        output: { continue?: boolean; reason?: string },
      ) => {
        try {
          const sid = input.sessionID;
          if (!sid) return;

          // Resilient fallback: the actor.postStop hook is undocumented and
          // its payload shape (including agentType) could change or be removed
          // without notice. If the runtime agent type is missing or
          // unrecognized, we must NOT self-approve by parsing a CLOSURE block
          // (that was a bypass: a subagent could emit readiness=done and skip
          // the Critic gate). Instead, log and fall through to the normal
          // decide() path so the configured review requirements still apply.
          const KNOWN_AGENT_TYPES = new Set([
            "critic",
            "build",
            "plan",
            "explore",
            "general",
            "designer",
            "writer",
            "vision",
            "manager",
          ]);
          if (!input.agentType || !KNOWN_AGENT_TYPES.has(input.agentType)) {
            logger.log(
              `[hiai-opencode] completion: unknown/missing agentType "${input.agentType ?? ""}" for ${sid.slice(0, 8)} — falling through to decide() without self-approval`,
            );
          }

          // Critic subagent: capture the verdict for the parent session.
          if (input.agentType === "critic") {
            const verdict = await readLastAssistantVerdict(sid);
            if (verdict) {
              const parent = input.parentSessionID ?? sid;
              st.recordCriticVerdict(parent, verdict);
            }
            return;
          }

          // Non-critic subagent completed: merge changed files from the
          // subagent's session into the parent's state, then decide whether
          // the parent should continue, review, or stop.
          const decideSessionID = input.parentSessionID ?? sid;
          if (input.parentSessionID) {
            const childState = st.get(sid);
            st.mergeChangedFiles(
              decideSessionID,
              childState.changedFiles,
              (fp) => matchesAnyGlob(fp, cfg.ui_globs),
            );
          }

          const s = st.get(decideSessionID);
          const action = decide({
            autoContinues: s.autoContinues,
            maxAutoContinues: cfg.max_auto_continues,
            hasIncompleteTodos: s.hasIncompleteTodos,
            changedFiles: s.changedFiles,
            currentFingerprint: st.currentFingerprint(s),
            reviewedFingerprint: s.reviewedFingerprint,
            criticVerdict: s.criticVerdict,
            blockerFlagged: s.blockerFlagged,
            uiChanged: s.uiChangedSinceReview,
            requireCritic: cfg.require_critic,
            qualityGateFailed: s.qualityGateFailed,
            lspPending: s.lspPending,
          });

          if (action.kind === "stop") {
            // Bob's ordinary final answer is the only summary. A synthetic
            // session.prompt creates a real turn and can cause a TUI loop, so
            // we never inject one here. On a stop we also must NOT set
            // output.continue or a noisy reason — the agent simply ends.
            return;
          }
          s.autoContinues += 1;
          output.continue = true;
          // Sanitize the reason so no raw session payload, oversized text, or
          // internal stack/IDs leak into the TUI link.
          output.reason = sanitizeReason(action.prompt);
        } catch (err) {
          // Fail safe: never auto-continue on an unexpected error. The
          // sub-helpers each have their own try/catch for I/O failures; this
          // top-level catch guards the rest of the body (decide(), state
          // mutations, summary injection) so a thrown error cannot wedge the
          // auto-continue loop or leave the session in a broken state.
          //
          // We deliberately do NOT emit a synthetic "retry" prompt here: that
          // would create a real turn and can cause a TUI loop. We just log the
          // failure (to the file log, never the TUI) and stop cleanly.
          logger.error("[hiai-opencode] Completion controller error:", err);
          output.continue = false;
          output.reason = undefined;
          return;
        }
      },
    },
  };
}
