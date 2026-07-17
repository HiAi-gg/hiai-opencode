import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { BobConfig } from "../../types";
import { DREAM_PROMPT } from "./dream";
import { DISTILL_PROMPT } from "./distill";
import { getLastRun, markFatal, save } from "./state";
import { logger } from "../../util/log";

export function createDreamDistillHook(
  config: BobConfig,
  client: PluginInput["client"],
): Pick<Hooks, "event" | "dispose"> {
  const dreamCfg = config.dream ?? { auto: true, interval_days: 7 };
  const distillCfg = config.distill ?? { auto: true, interval_days: 30 };

  const SENTINEL_FATAL = -1;

  // ── Anti-replay / rate-limit guard ──
  //
  // session.idle / session.created can fire in bursts (e.g. many sessions
  // created in quick succession, or repeated idle pings). Without a guard the
  // hook would spawn duplicate dream/distill sessions and flood the runtime
  // with noise. We debounce per-trigger-type with an in-memory cooldown and
  // additionally rely on the persisted last-run timestamp for the long-term
  // interval gate. The in-memory guard is the fast path that suppresses
  // bursty repeats within `burstCooldownMs`; the persisted gate enforces the
  // configured interval_days.
  const burstCooldownMs =
    typeof (config.dream as Record<string, unknown>)?.burst_cooldown_ms ===
    "number"
      ? ((config.dream as Record<string, unknown>).burst_cooldown_ms as number)
      : 60_000;

  const lastTriggerAt = new Map<string, number>();

  const isBurstBlocked = (trigger: string): boolean => {
    const prev = lastTriggerAt.get(trigger);
    const now = Date.now();
    if (prev !== undefined && now - prev < burstCooldownMs) return true;
    lastTriggerAt.set(trigger, now);
    return false;
  };

  return {
    event: async (input) => {
      const evt = input.event as {
        type: string;
        properties?: Record<string, unknown>;
      };
      if (evt.type !== "session.idle" && evt.type !== "session.created") return;

      // Fast-path burst guard: never act on the same trigger type more than
      // once per burstCooldownMs. This is idempotent across repeated events.
      if (isBurstBlocked(evt.type)) return;

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const lastRun = getLastRun();

      const checkAndRun = async (
        kind: "dream" | "distill",
        intervalDays: number,
        auto: boolean,
      ) => {
        if (!auto) return;

        const key = `last_${kind}_run`;

        // Fatal error: prompt constant is missing from the bundle.
        if (lastRun.get(key) === SENTINEL_FATAL) return;

        const last = lastRun.get(key) ?? 0;
        if (now - last < intervalDays * dayMs) return;

        lastRun.set(key, now);
        save();

        const prompt = kind === "dream" ? DREAM_PROMPT : DISTILL_PROMPT;

        if (!prompt) {
          logger.error(
            `[hiai-opencode] Auto-${kind}: prompt constant is empty — packaging defect. ` +
              "Dream/Distill will not attempt again until the plugin is reloaded.",
          );
          markFatal(key);
          save();
          return;
        }

        try {
          const created = await client.session.create({
            body: { title: `Auto ${kind === "dream" ? "Dream" : "Distill"}` },
          });
          const session =
            "data" in created && created.data ? created.data : null;
          if (!session) {
            logger.error(
              `[hiai-opencode] Auto-${kind} failed: session.create returned no data`,
            );
            return;
          }

          await client.session.prompt({
            path: { id: session.id },
            body: {
              parts: [{ type: "text", text: prompt }],
              agent:
                kind === "dream" ? "dream-consolidator" : "distill-packager",
            },
          });

          logger.log(
            `[hiai-opencode] Auto-${kind} triggered: session ${session.id}`,
          );
        } catch (err) {
          logger.error(`[hiai-opencode] Auto-${kind} failed:`, err);
          lastRun.delete(key);
          save();
        }
      };

      await checkAndRun(
        "dream",
        dreamCfg.interval_days ?? 7,
        dreamCfg.auto ?? true,
      );
      await checkAndRun(
        "distill",
        distillCfg.interval_days ?? 30,
        distillCfg.auto ?? true,
      );
    },

    dispose: async () => {
      // Drop in-memory burst guard so a plugin reload starts clean.
      lastTriggerAt.clear();
    },
  };
}
