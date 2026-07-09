import type { Hooks, PluginInput } from '@opencode-ai/plugin';
import type { BobConfig } from '../../types';
import { decide } from './decide';
import { aggregateEndpoints } from './port-scanner';
import { matchesAnyGlob, parseCriticVerdict } from './signals';
import * as st from './state';
import { buildSummary, parseClosureBlock } from './summary-builder';

let client: PluginInput['client'] | null = null;

// Local type — @opencode-ai/plugin doesn't export this
// The runtime actor.postStop hook is registered as an object with matcher+run,
// not as a raw function — see the registration object at line ~207.
type ActorPostStopRegistration = {
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

export function setCompletionClient(c: PluginInput['client']) {
  client = c;
}

export function createBobCompletionHook(
  config: BobConfig,
): Pick<Hooks, 'tool.execute.after' | 'event' | 'chat.message'> & Record<string, unknown> {
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
  ): Promise<'approved' | 'rejected' | null> {
    if (!client) return null;
    try {
      const res = await client.session.messages({ path: { id: sessionID } });
      const msgs = (res.data ?? []) as Array<{
        info?: { role?: string };
        parts?: Array<{ type?: string; text?: string }>;
      }>;
      const lastAssistant = [...msgs].reverse().find((m) => m.info?.role === 'assistant');
      const text = (lastAssistant?.parts ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('');
      return parseCriticVerdict(text);
    } catch {
      return null;
    }
  }

  async function readLastAssistantMessage(
    sessionID: string,
  ): Promise<{ messageID: string; text: string } | null> {
    if (!client) return null;
    try {
      const res = await client.session.messages({ path: { id: sessionID } });
      const msgs = (res.data ?? []) as Array<{
        info?: { id?: string; role?: string };
        parts?: Array<{ type?: string; text?: string; tool?: string; state?: { output?: string } }>;
      }>;
      const lastAssistant = [...msgs].reverse().find((m) => m.info?.role === 'assistant');
      const id = lastAssistant?.info?.id;
      if (!id) return null;
      const text = (lastAssistant?.parts ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('');
      return { messageID: id, text };
    } catch {
      return null;
    }
  }

  async function readRecentToolOutputs(
    sessionID: string,
  ): Promise<Array<{ tool: string; output: string }>> {
    if (!client) return [];
    try {
      const res = await client.session.messages({ path: { id: sessionID } });
      const msgs = (res.data ?? []) as Array<{
        info?: { role?: string; id?: string };
        parts?: Array<{
          type?: string;
          tool?: string;
          state?: { status?: string; output?: string };
        }>;
      }>;
      const lastAssistantIdx = [...msgs].reverse().findIndex((m) => m.info?.role === 'assistant');
      if (lastAssistantIdx < 0) return [];
      // Walk backwards from the last assistant message — recent bash/read tool
      // outputs are the most likely source of "the user started something".
      const startIdx = msgs.length - 1 - lastAssistantIdx;
      const window = msgs.slice(Math.max(0, startIdx - 4), startIdx + 1);
      return window.flatMap((m) =>
        (m.parts ?? []).flatMap((p) => {
          if (p.type !== 'tool') return [];
          if (!p.tool) return [];
          const output = p.state?.output;
          if (!output) return [];
          return [{ tool: p.tool, output }];
        }),
      );
    } catch {
      return [];
    }
  }

  async function readRemainingTodos(sessionID: string): Promise<string[]> {
    if (!client) return [];
    try {
      // Try the typed session.todos endpoint when available; otherwise fall
      // back to scanning the last assistant message for a TODO list. Either
      // way we keep this resilient to schema drift.
      const api = client.session as unknown as {
        todos?: (input: { path: { id: string } }) => Promise<{
          data?: Array<{ content?: string; status?: string }>;
        }>;
      };
      if (typeof api.todos === 'function') {
        const res = await api.todos({ path: { id: sessionID } });
        const list = res.data ?? [];
        return list
          .filter((t) => t.status && t.status !== 'completed' && t.status !== 'cancelled')
          .map((t) => t.content ?? '')
          .filter(Boolean);
      }
    } catch {
      // fall through
    }
    return [];
  }

  async function injectSummary(sessionID: string, reason: string): Promise<void> {
    if (!client) return;
    try {
      const lastAssistant = await readLastAssistantMessage(sessionID);
      const messageID = lastAssistant?.messageID;
      const closure = parseClosureBlock(lastAssistant?.text ?? '');
      const endpoints = aggregateEndpoints(await readRecentToolOutputs(sessionID));
      const remaining = await readRemainingTodos(sessionID);
      const text = buildSummary({
        closure,
        endpoints,
        remaining,
        sessionLabel: reason ? `decision: ${reason}` : undefined,
      });
      // Post summary as synthetic user message via SDK (avoids core deps)
      if (client) {
        await client.session.prompt({
          path: { id: sessionID },
          body: {
            parts: [{ type: 'text', text, metadata: { bob_summary: true } }],
          },
        });
      }
    } catch {
      // Summary injection is best-effort; never break the stop path.
    }
  }

  return {
    'tool.execute.after': async (input, _output) => {
      const sid = input.sessionID;
      if (!sid) return;
      if (input.tool !== 'write' && input.tool !== 'edit' && input.tool !== 'apply_patch') return;
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
    'chat.message': async (input, _output) => {
      if (cfg.reset_on_user_message && input.sessionID) {
        st.resetForUser(input.sessionID);
      }
    },

    // Listen for todo updates to feed hasIncompleteTodos into the decision
    // state machine, so decide() knows whether there is still work to do.
    event: async (input) => {
      const evt = input.event as
        | { type: string; properties: { sessionID: string; todos: Array<{ status: string }> } }
        | undefined;
      if (evt?.type === 'todo.updated' && evt.properties) {
        const hasIncomplete = evt.properties.todos.some(
          (t) => t.status !== 'completed' && t.status !== 'cancelled',
        );
        st.setHasIncompleteTodos(evt.properties.sessionID, hasIncomplete);
      }
    },

    'actor.postStop': {
      matcher: { mode: 'peer' },
      run: async (
        input: { sessionID: string; agentType: string; parentSessionID?: string },
        output: { continue?: boolean; reason?: string },
      ) => {
        const sid = input.sessionID;
        if (!sid) return;

        // Critic subagent: capture the verdict for the parent session.
        if (input.agentType === 'critic') {
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
          for (const fp of childState.changedFiles) {
            st.recordChangedFile(decideSessionID, fp, matchesAnyGlob(fp, cfg.ui_globs));
          }
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
        });

        if (action.kind === 'stop') {
          // Inject the completion summary as a synthetic ignored text part
          // on the last assistant message. The TUI picks it up via the
          // `bob_summary` metadata flag and renders it as a stylized card.
          await injectSummary(decideSessionID, action.reason);
          return;
        }
        s.autoContinues += 1;
        output.continue = true;
        output.reason = action.prompt;
      },
    },
  };
}
