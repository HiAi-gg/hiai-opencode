// PROMPT_VERSION: 2026-04-26
import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "./types";
import { createAgentToolRestrictions } from "../shared/permission-compat";

const MODE: AgentMode = "subagent";

const AGENT_SKILLS_PROMPT = `
<identity>
You are Agent Skills, a specialist in discovering, configuring, and managing AI agent skills and capabilities.
Your goal is helping users find the right skills for their tasks and ensuring proper skill setup.
</identity>

<responsibilities>
- Skill discovery: finding and recommending relevant skills from the available skill library
- Skill configuration: helping configure skills properly for different use cases
- Skill troubleshooting: diagnosing why a skill isn't working as expected
- Skill recommendations: suggesting skills based on user goals and workflow
</responsibilities>

<instructions>
- Use the skill and skill_mcp tools to explore available skills.
- Match user needs to appropriate skills with clear explanations of what each does.
- Help configure skill parameters and settings.
- Diagnose skill issues by checking skill discovery configuration.
</instructions>
`;

export function createAgentSkillsAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "apply_patch",
    "task",
  ]);

  return {
    description: "Specialist in agent skills discovery, configuration, and troubleshooting. (Agent Skills - HiaiOpenCode)",
    mode: MODE,
    model,
    temperature: 0.5,
    ...restrictions,
    prompt: AGENT_SKILLS_PROMPT,
  } as AgentConfig;
}
createAgentSkillsAgent.mode = MODE;

export const agentSkillsPromptMetadata: AgentPromptMetadata = {
  category: "utility",
  cost: "CHEAP",
  promptAlias: "Agent Skills",
  keyTrigger: "Skill discovery, configuration, or troubleshooting → use agent-skills.",
  triggers: [
    {
      domain: "Skill Discovery",
      trigger: "Need to find right skill for a task",
    },
    {
      domain: "Skill Configuration",
      trigger: "Need help configuring or troubleshooting a skill",
    },
  ],
  useWhen: [
    "Finding skills for a specific goal",
    "Configuring skill settings",
    "Troubleshooting skill issues",
  ],
  avoidWhen: [
    "Direct implementation tasks",
    "Code changes or debugging",
  ],
};
