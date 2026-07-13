import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { BobConfig } from "../../types";
import { DREAM_PROMPT } from "./dream";
import { DISTILL_PROMPT } from "./distill";
import { getLastRun, markFatal, save } from "./state";

export function createDreamDistillHook(
  config: BobConfig,
  client: PluginInput["client"],
): Pick<Hooks, "event"> {
  const dreamCfg = config.dream ?? { auto: true, interval_days: 7 };
  const distillCfg = config.distill ?? { auto: true, interval_days: 30 };

  const SENTINEL_FATAL = -1;

  return {
    event: async (input) => {
      const evt = input.event as {
        type: string;
        properties?: Record<string, unknown>;
      };
      if (evt.type !== "session.idle" && evt.type !== "session.created") return;

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
          console.error(
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
            console.error(
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

          console.log(
            `[hiai-opencode] Auto-${kind} triggered: session ${session.id}`,
          );
        } catch (err) {
          console.error(`[hiai-opencode] Auto-${kind} failed:`, err);
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
  };
}
