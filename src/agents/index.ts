import type { AgentConfig, BobConfig } from "../types";
import { getToolSetting } from "../config";
import { BOB_PROMPT } from "./bob";
import { CRITIC_PROMPT } from "./critic";
import { DESIGNER_PROMPT } from "./designer";
import { MANAGER_PROMPT } from "./manager";
import { VISION_PROMPT } from "./vision";
import { WRITER_PROMPT } from "./writer";

export interface AgentDefinition {
  key: string;
  config: AgentConfig;
}

function resolveModel(agentKey: string, config: BobConfig): string | undefined {
  return config.models?.[agentKey]?.model;
}

export function resolveAgentModel(
  agentKey: string,
  config: BobConfig,
): string | undefined {
  return (
    config.agent_overrides?.[agentKey]?.model ?? config.models?.[agentKey]?.model
  );
}

export function applyPromptOverride(
  agentKey: string,
  prompt: string,
  config: BobConfig,
): string {
  const append = config.agent_overrides?.[agentKey]?.prompt_append?.trim();
  return append ? `${prompt}\n\n${append}` : prompt;
}

export function createAllAgents(config: BobConfig): AgentDefinition[] {
  const disabled = new Set(config.disabled_agents ?? []);

  const agents: { key: string; config: AgentConfig }[] = [
    {
      key: "bob",
      config: {
        name: "Bob",
        description:
          "Orchestrator — research, delegate, verify. Primary agent for all tasks.",
        mode: "primary",
        model: resolveModel("bob", config),
        prompt: BOB_PROMPT,
        temperature: getToolSetting('agent_temp_bob', 0.3),
      },
    },
    {
      key: "manager",
      config: {
        name: "Manager",
        description:
          "Architecture — systems, boundaries, integration, delegation coordination.",
        mode: "subagent",
        hidden: true,
        model: resolveModel("manager", config),
        prompt: MANAGER_PROMPT,
        temperature: getToolSetting('agent_temp_manager', 0.2),
      },
    },
    {
      key: "critic",
      config: {
        name: "Critic",
        description:
          "Plan critic — reviewing plans for clarity, verifiability, and quality.",
        mode: "subagent",
        hidden: true,
        model: resolveModel("critic", config),
        prompt: CRITIC_PROMPT,
        temperature: getToolSetting('agent_temp_critic', 0.1),
      },
    },
    {
      key: "writer",
      config: {
        name: "Writer",
        description:
          "Content, copy, positioning, SEO. Website/product copy specialist.",
        mode: "subagent",
        hidden: true,
        model: resolveModel("writer", config),
        prompt: WRITER_PROMPT,
        temperature: getToolSetting('agent_temp_writer', 0.5),
      },
    },
    {
      key: "designer",
      config: {
        name: "Designer",
        description:
          "UI/visual direction via design systems and component specifications.",
        mode: "subagent",
        hidden: true,
        model: resolveModel("designer", config),
        prompt: DESIGNER_PROMPT,
        temperature: getToolSetting('agent_temp_designer', 0.4),
      },
    },
    {
      key: "vision",
      config: {
        name: "Vision",
        description:
          "Analyze images, PDFs, diagrams. Visual content extraction and verification.",
        mode: "subagent",
        hidden: true,
        model: resolveModel("vision", config),
        prompt: VISION_PROMPT,
        temperature: getToolSetting('agent_temp_vision', 0.2),
        thinking: { type: "disabled" },
      },
    },
    {
      key: "dream-consolidator",
      config: {
        name: "Dream Consolidator",
        description:
          "Memory consolidation agent — cross-session knowledge synthesis.",
        mode: "subagent",
        hidden: true,
        model: resolveModel("bob", config),
        prompt:
          "You are the Dream Consolidator — a memory consolidation agent for HiAi OpenCode. Your full operational protocol is injected at invocation via the dream-distill hook. Core responsibility: cross-session knowledge synthesis, memory deduplication, and durable knowledge extraction from agent trajectories.",
        temperature: getToolSetting('agent_temp_dream', 0.2),
      },
    },
    {
      key: "distill-packager",
      config: {
        name: "Distill Packager",
        description:
          "Workflow packaging agent — discovers repeated patterns, creates skills/agents.",
        mode: "subagent",
        hidden: true,
        model: resolveModel("bob", config),
        prompt:
          "You are the Distill Packager — a workflow packaging agent for HiAi OpenCode. Your full operational protocol is injected at invocation via the dream-distill hook. Core responsibility: pattern discovery, workflow distillation, and reproducible packaging of agent behaviors.",
        temperature: getToolSetting('agent_temp_distill', 0.3),
      },
    },
  ];

  return agents
    .filter((a) => !disabled.has(a.key))
    .map((a) => ({
      key: a.key,
      config: {
        ...a.config,
        prompt: applyPromptOverride(a.key, a.config.prompt, config),
        ...(config.agent_overrides?.[a.key] ?? {}),
      },
    }));
}
