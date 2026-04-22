import { createBobAgent } from "../src/agents/bob";
import { createCoderAgent } from "../src/agents/coder/agent";
import { createCriticAgent } from "../src/agents/critic/agent";
import { createGuardAgent } from "../src/agents/guard/agent";
import { createResearcherAgent } from "../src/agents/researcher";
import { createBobJuniorAgentWithOverrides } from "../src/agents/sub/agent";
import { getStrategistPrompt } from "../src/agents/strategist/index";
import { createQualityGuardianAgent } from "../src/agents/quality-guardian";
import { createPlatformManagerAgent } from "../src/agents/platform-manager";
import { createMultimodalLookerAgent } from "../src/agents/ui";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "dist", "prompt-snapshots");

const emptyAgents: any[] = [];
const emptyTools: any[] = [];
const emptySkills: any[] = [];
const emptyCategories: any[] = [];

interface AgentTarget {
  name: string;
  factory: () => { prompt: string; description?: string };
}

const HEADER = `<!--
  BASELINE SNAPSHOT — do not edit manually
  ~tokens = bytes / 4 (approximate, varies by model)
-->

`;

function bytesToTokens(bytes: number): number {
  return Math.round(bytes / 4);
}

function writeSnapshot(filename: string, prompt: string): void {
  const bytes = Buffer.byteLength(prompt, "utf8");
  const tokens = bytesToTokens(bytes);
  const content =
    HEADER +
    prompt +
    `\n\n<!-- ${bytes} bytes · ~${tokens} tokens -->`;
  const filepath = join(OUT_DIR, filename);
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, content, "utf8");
  const { readFileSync: read } = require("fs");
  const verify = read(filepath, "utf8") as string;
  if (verify !== content) {
    throw new Error(`Snapshot not deterministic: ${filename}`);
  }
  console.log(`  ${filename} — ${bytes} B · ~${tokens} tokens`);
}

const targets: AgentTarget[] = [
  {
    name: "bob.default",
    factory: () =>
      createBobAgent(
        "claude",
        emptyAgents,
        emptyTools,
        emptySkills,
        emptyCategories,
        false,
      ),
  },
  {
    name: "bob.gpt-pro",
    factory: () =>
      createBobAgent(
        "gpt/5.4-pro",
        emptyAgents,
        emptyTools,
        emptySkills,
        emptyCategories,
        false,
      ),
  },
  {
    name: "bob.gemini",
    factory: () =>
      createBobAgent(
        "google/gemini-3.1-pro",
        emptyAgents,
        emptyTools,
        emptySkills,
        emptyCategories,
        false,
      ),
  },
  {
    name: "coder.gpt",
    factory: () =>
      createCoderAgent(
        "gpt",
        emptyAgents,
        emptyTools,
        emptySkills,
        emptyCategories,
        false,
      ),
  },
  {
    name: "coder.gpt-codex",
    factory: () =>
      createCoderAgent(
        "github-copilot/gpt-5.3-codex",
        emptyAgents,
        emptyTools,
        emptySkills,
        emptyCategories,
        false,
      ),
  },
  {
    name: "coder.gpt-pro",
    factory: () =>
      createCoderAgent(
        "gpt/5.4-pro",
        emptyAgents,
        emptyTools,
        emptySkills,
        emptyCategories,
        false,
      ),
  },
  {
    name: "critic",
    factory: () => createCriticAgent("claude"),
  },
  {
    name: "guard",
    factory: () =>
      createGuardAgent({
        model: "claude",
        availableAgents: emptyAgents,
        availableSkills: emptySkills,
      }),
  },
  {
    name: "strategist",
    factory: () => {
      const prompt = getStrategistPrompt("claude");
      return { prompt, description: "Strategist prompt" };
    },
  },
  {
    name: "sub",
    factory: () =>
      createBobJuniorAgentWithOverrides(undefined, "claude", false),
  },
  {
    name: "researcher",
    factory: () => createResearcherAgent("claude"),
  },
  {
    name: "quality-guardian",
    factory: () => createQualityGuardianAgent("claude"),
  },
  {
    name: "platform-manager",
    factory: () => createPlatformManagerAgent("claude"),
  },
  {
    name: "multimodal",
    factory: () => createMultimodalLookerAgent("claude"),
  },
];

console.log("\n📏 Building prompt snapshots...\n");

let totalBytes = 0;
for (const target of targets) {
  const { name } = target;
  try {
    const { prompt } = target.factory();
    writeSnapshot(`${name}.md`, prompt);
    totalBytes += Buffer.byteLength(prompt, "utf8");
  } catch (err) {
    console.error(`  ERROR [${name}]: ${(err as Error).message}`);
  }
}

const totalTokens = bytesToTokens(totalBytes);
console.log(
  `\n✅ Done — ${totalBytes} B total · ~${totalTokens} tokens across ${targets.length} snapshots\n`,
);
console.log("📁 Snapshots written to: dist/prompt-snapshots/");
console.log("   Commit these BEFORE modifying any prompt code (T18 baseline rule)\n");