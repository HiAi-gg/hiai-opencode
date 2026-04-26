import { createBuiltinAgents } from "../agents";
import { createBobJuniorAgentWithOverrides } from "../agents/sub";
import type { HiaiOpenCodeConfig } from "../config";
import { isTaskSystemEnabled, log, migrateAgentConfig } from "../shared";
import { getAgentRuntimeName } from "../shared/agent-display-names";
import { AGENT_NAME_MAP } from "../shared/migration";
import { registerAgentName } from "../features/claude-code-session-state";
import {
  discoverConfigSourceSkills,
  discoverManagedPluginSkills,
  deduplicateSkillsByName,
  discoverGlobalAgentsSkills,
  discoverOpencodeGlobalSkills,
  discoverOpencodeProjectSkills,
  discoverProjectAgentsSkills,
  discoverProjectClaudeSkills,
  discoverUserClaudeSkills,
} from "../features/opencode-skill-loader";
import { 
  loadProjectAgents, 
  loadUserAgents, 
  loadOpencodeGlobalAgents, 
  loadOpencodeProjectAgents,
  loadAgentDefinitions,
  readOpencodeConfigAgents,
} from "../features/claude-code-agent-loader";
import type { PluginComponents } from "./plugin-components-loader";
import { reorderAgentsByPriority } from "./agent-priority-order";
import { remapAgentKeysToDisplayNames } from "./agent-key-remapper";
import {
  createProtectedAgentNameSet,
  filterProtectedAgentOverrides,
} from "./agent-override-protection";
import { buildStrategistAgentConfig } from "./strategist-agent-config-builder";
import { resolveSkillDiscoveryConfig } from "../plugin/skill-discovery-config";

type AgentConfigRecord = Record<string, Record<string, unknown> | undefined> & {
  build?: Record<string, unknown>;
  plan?: Record<string, unknown>;
};

const CANONICAL_VISIBLE_AGENT_NAMES = [
  "Bob",
  "Coder",
  "Strategist",
  "Guard",
  "Critic",
  "Designer",
  "Researcher",
  "Manager",
  "Brainstormer",
  "Vision",
] as const;

const RUNTIME_AGENT_DESCRIPTIONS: Partial<Record<string, string>> = {
  "Bob":
    "Primary orchestrator for end-to-end task execution, delegation, and high-level workflow control. (Bob - HiaiOpenCode)",
  "Coder":
    "High-depth executor for multi-file implementation, substantial refactors, and technical delivery. (Coder - HiaiOpenCode)",
  "Strategist":
    "Planning and architecture agent for decomposition, sequencing, and decision framing before execution. (Strategist - HiaiOpenCode)",
  "Guard":
    "Execution supervisor that routes work, enforces discipline, and keeps delegated flows on track. (Guard - HiaiOpenCode)",
  "Critic":
    "High-accuracy review gate for implementation quality, correctness, and plan validation. (Critic - HiaiOpenCode)",
  "Designer":
    "Creative visual problem-solver for high-touch UI, interaction, and brand-level interface direction. (Designer - HiaiOpenCode)",
  "Researcher":
    "Specialized in codebase exploration and external documentation research. (Researcher - HiaiOpenCode)",
  "Manager":
    "Unified platform management agent for session continuity, project initialization, and mindmodel orchestration. (Manager - HiaiOpenCode)",
  "Brainstormer":
    "Idea exploration agent for divergent thinking, option generation, and concept shaping before execution. (Brainstormer - HiaiOpenCode)",
  "Vision":
    "Multimodal analysis agent for images, PDFs, diagrams, and other media that require interpretation beyond plain text. (Vision - HiaiOpenCode)",
  "Agent Skills":
    "System agent for skill registry, discovery, and capability orchestration. Not for direct user-facing work. (Agent Skills - HiaiOpenCode)",
  "Sub":
    "Compatibility wrapper for bounded low-risk execution now folded into Coder's execution contour. (Sub - HiaiOpenCode)",
  "Quality Guardian":
    "Compatibility wrapper for review functions now folded into Critic. (Quality Guardian - HiaiOpenCode)",
};

function forceVisiblePrimaryAgent(agent: unknown, name: string, forceMode?: "primary" | "all"): unknown {
  if (typeof agent !== "object" || agent === null) {
    return agent;
  }

  const base = agent as Record<string, unknown>;
  return {
    ...base,
    name,
    hidden: false,
    mode: forceMode ?? "all",
    ...(typeof base.description === "string" && base.description.trim().length > 0
      ? {}
      : { description: RUNTIME_AGENT_DESCRIPTIONS[name] }),
  };
}

function forceHiddenCompatibilityAgent(agent: unknown, name: string): unknown {
  const base =
    typeof agent === "object" && agent !== null
      ? (agent as Record<string, unknown>)
      : {};

  return {
    ...base,
    name,
    hidden: true,
    mode: "subagent",
    description: RUNTIME_AGENT_DESCRIPTIONS[name] ?? base.description,
  };
}

function getConfiguredDefaultAgent(config: Record<string, unknown>): string | undefined {
  const defaultAgent = config.default_agent;
  if (typeof defaultAgent !== "string") return undefined;
  const trimmedDefaultAgent = defaultAgent.trim();
  return trimmedDefaultAgent.length > 0 ? trimmedDefaultAgent : undefined;
}

export async function applyAgentConfig(params: {
  config: Record<string, unknown>;
  pluginConfig: HiaiOpenCodeConfig;
  ctx: { directory: string; client?: any };
  pluginComponents: PluginComponents;
}): Promise<Record<string, unknown>> {
  const migratedDisabledAgents = (params.pluginConfig.disabled_agents ?? []).map(
    (agent) => {
      return AGENT_NAME_MAP[agent.toLowerCase()] ?? AGENT_NAME_MAP[agent] ?? agent;
    },
  ) as typeof params.pluginConfig.disabled_agents;

  const discovery = resolveSkillDiscoveryConfig(params.pluginConfig);
  const [
    discoveredManagedPluginSkills,
    discoveredConfigSourceSkills,
    discoveredUserSkills,
    discoveredProjectSkills,
    discoveredProjectAgentsSkills,
    discoveredOpencodeGlobalSkills,
    discoveredOpencodeProjectSkills,
    discoveredGlobalAgentsSkills,
  ] = await Promise.all([
    discoverManagedPluginSkills(),
    discovery.config_sources
      ? discoverConfigSourceSkills({
        config: params.pluginConfig.skills,
        configDir: params.ctx.directory,
      })
      : Promise.resolve([]),
    discovery.global_claude ? discoverUserClaudeSkills() : Promise.resolve([]),
    discovery.project_claude
      ? discoverProjectClaudeSkills(params.ctx.directory)
      : Promise.resolve([]),
    discovery.project_agents
      ? discoverProjectAgentsSkills(params.ctx.directory)
      : Promise.resolve([]),
    discovery.global_opencode ? discoverOpencodeGlobalSkills() : Promise.resolve([]),
    discovery.project_opencode ? discoverOpencodeProjectSkills(params.ctx.directory) : Promise.resolve([]),
    discovery.global_agents ? discoverGlobalAgentsSkills() : Promise.resolve([]),
  ]);

  const allDiscoveredSkills = [
    ...discoveredManagedPluginSkills,
    ...discoveredConfigSourceSkills,
    ...discoveredOpencodeProjectSkills,
    ...discoveredProjectSkills,
    ...discoveredProjectAgentsSkills,
    ...discoveredOpencodeGlobalSkills,
    ...discoveredUserSkills,
    ...discoveredGlobalAgentsSkills,
  ];
  const deduplicatedDiscoveredSkills = deduplicateSkillsByName(allDiscoveredSkills);

  const browserProvider =
    params.pluginConfig.browser_automation_engine?.provider ?? "playwright";
  const currentModel = params.config.model as string | undefined;
  const disabledSkills = new Set<string>(params.pluginConfig.disabled_skills ?? []);
  const useTaskSystem = isTaskSystemEnabled(params.pluginConfig);
  const disableOmoEnv = params.pluginConfig.experimental?.disable_omo_env ?? false;

  const includeClaudeAgents = params.pluginConfig.claude_code?.agents ?? true;
  const userAgents = includeClaudeAgents ? loadUserAgents() : {};
  const projectAgents = includeClaudeAgents ? loadProjectAgents(params.ctx.directory) : {};
  const opencodeGlobalAgents = loadOpencodeGlobalAgents();
  const opencodeProjectAgents = loadOpencodeProjectAgents(params.ctx.directory);
  const rawPluginAgents = params.pluginComponents.agents;

  const agentDefinitionAgents = params.pluginConfig.agent_definitions
    ? loadAgentDefinitions(params.pluginConfig.agent_definitions, "definition-file")
    : {};
  const opencodeConfigAgents = readOpencodeConfigAgents(params.ctx.directory);

  const pluginAgents = Object.fromEntries(
    Object.entries(rawPluginAgents).map(([key, value]) => {
      if (!value) return [key, value];
      const migrated = migrateAgentConfig(value as Record<string, unknown>);
      if (!migrated.mode) migrated.mode = "subagent";
      return [key, migrated];
    }),
  );

  const configAgent = params.config.agent as AgentConfigRecord | undefined;

  const customAgentSummaries = [
    ...Object.entries(configAgent ?? {}),
    ...Object.entries(userAgents),
    ...Object.entries(projectAgents),
    ...Object.entries(opencodeGlobalAgents),
    ...Object.entries(opencodeProjectAgents),
    ...Object.entries(pluginAgents).filter(([, config]) => config !== undefined),
    ...Object.entries(agentDefinitionAgents),
    ...Object.entries(opencodeConfigAgents),
  ]
    .filter(([, config]) => config != null)
    .map(([name, config]) => ({
      name,
      description: typeof (config as Record<string, unknown>)?.description === "string"
        ? ((config as Record<string, unknown>).description as string)
        : "",
    }));

  log(
    "[agent-config-handler] Agent sources loaded",
    {
      user: Object.keys(userAgents).length,
      project: Object.keys(projectAgents).length,
      opencodeGlobal: Object.keys(opencodeGlobalAgents).length,
      opencodeProject: Object.keys(opencodeProjectAgents).length,
      plugin: Object.keys(pluginAgents).length,
      agentDefinitions: Object.keys(agentDefinitionAgents).length,
      opencodeConfig: Object.keys(opencodeConfigAgents).length,
      config: Object.keys(configAgent ?? {}).length,
    }
  );

  const builtinAgents = await createBuiltinAgents(
    migratedDisabledAgents,
    params.pluginConfig.agents,
    params.ctx.directory,
    currentModel,
    params.pluginConfig.categories,
    params.pluginConfig.git_master,
    deduplicatedDiscoveredSkills,
    customAgentSummaries,
    browserProvider,
    currentModel,
    disabledSkills,
    useTaskSystem,
    disableOmoEnv,
  );

  const disabledAgentNames = new Set(
    (migratedDisabledAgents ?? []).map(a => a.toLowerCase())
  );

  const filterDisabledAgents = (agents: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(agents).filter(([name]) => !disabledAgentNames.has(name.toLowerCase()))
    );

  const isBobEnabled = params.pluginConfig.bob_agent?.disabled !== true;
  const builderEnabled =
    params.pluginConfig.bob_agent?.default_builder_enabled ?? false;
  const plannerEnabled = params.pluginConfig.bob_agent?.planner_enabled ?? true;
  const replacePlan = params.pluginConfig.bob_agent?.replace_plan ?? true;
  const configuredDefaultAgent = getConfiguredDefaultAgent(params.config);

  if (isBobEnabled && builtinAgents.bob) {
    if (configuredDefaultAgent) {
      (params.config as { default_agent?: string }).default_agent =
        getAgentRuntimeName(configuredDefaultAgent);
    } else {
      (params.config as { default_agent?: string }).default_agent =
        getAgentRuntimeName("bob");
    }

    // Assembly order: Bob -> Coder -> Strategist -> Guard
    const agentConfig: Record<string, unknown> = {
      "bob": builtinAgents.bob,
    };

    if (builtinAgents.coder) {
      agentConfig["coder"] = builtinAgents.coder;
    }

    if (plannerEnabled) {
      const strategistOverride = params.pluginConfig.agents?.["strategist"] as
        | (Record<string, unknown> & { prompt_append?: string })
        | undefined;

      agentConfig["strategist"] = await buildStrategistAgentConfig({
        configAgentPlan: configAgent?.plan,
        pluginStrategistOverride: strategistOverride,
        userCategories: params.pluginConfig.categories,
        currentModel,
        disabledTools: params.pluginConfig.disabled_tools,
      });
    }

    if (builtinAgents.guard) {
      agentConfig["guard"] = builtinAgents.guard;
    }

    if (builtinAgents.designer) {
      agentConfig["designer"] = builtinAgents.designer;
    }

    agentConfig["sub"] = createBobJuniorAgentWithOverrides(
      params.pluginConfig.agents?.["sub"],
      (builtinAgents.guard as { model?: string } | undefined)?.model,
      useTaskSystem,
    );

    if (builderEnabled) {
      const { name: _buildName, ...buildConfigWithoutName } =
        configAgent?.build ?? {};
      const migratedBuildConfig = migrateAgentConfig(
        buildConfigWithoutName as Record<string, unknown>,
      );
      const override = params.pluginConfig.agents?.["OpenCode-Builder"];
      const base = {
        ...migratedBuildConfig,
        description: `${(configAgent?.build?.description as string) ?? "Build agent"} (OpenCode default)`,
      };
      agentConfig["OpenCode-Builder"] = override ? { ...base, ...override } : base;
    }

    const filteredConfigAgents = configAgent
      ? Object.fromEntries(
          Object.entries(configAgent)
            .filter(([key]) => {
              if (key === "build") return false;
              if (key === "plan") return false;
              if (key in builtinAgents) return false;
              return true;
            })
            .map(([key, value]) => {
              if (!value) return [key, value];
              const migrated = migrateAgentConfig(value as Record<string, unknown>);
              if (!migrated.mode) migrated.mode = "subagent";
              return [key, migrated];
            }),
        )
      : {};

    const migratedBuild = configAgent?.build
      ? migrateAgentConfig(configAgent.build as Record<string, unknown>)
      : {};

    const protectedBuiltinAgentNames = createProtectedAgentNameSet([
      ...Object.keys(agentConfig),
      ...Object.keys(builtinAgents),
    ]);
    const filteredUserAgents = filterProtectedAgentOverrides(
      userAgents,
      protectedBuiltinAgentNames,
    );
    const filteredProjectAgents = filterProtectedAgentOverrides(
      projectAgents,
      protectedBuiltinAgentNames,
    );
    const filteredPluginAgents = filterProtectedAgentOverrides(
      pluginAgents,
      protectedBuiltinAgentNames,
    );
    const filteredOpencodeGlobalAgents = filterProtectedAgentOverrides(
      opencodeGlobalAgents,
      protectedBuiltinAgentNames,
    );
    const filteredOpencodeProjectAgents = filterProtectedAgentOverrides(
      opencodeProjectAgents,
      protectedBuiltinAgentNames,
    );
    const filteredAgentDefinitionAgents = filterProtectedAgentOverrides(
      agentDefinitionAgents,
      protectedBuiltinAgentNames,
    );
    const filteredOpencodeConfigAgents = filterProtectedAgentOverrides(
      opencodeConfigAgents,
      protectedBuiltinAgentNames,
    );

    params.config.agent = {
      ...agentConfig,
      ...Object.fromEntries(
        Object.entries(builtinAgents).filter(
          ([key]) => key !== "bob" && key !== "coder" && key !== "guard" && key !== "strategist" && key !== "sub",
        ),
      ),
      // Precedence: later entries override earlier (project > global > user > plugin)
      ...filterDisabledAgents(filteredPluginAgents),
      ...filterDisabledAgents(filteredUserAgents),
      ...filterDisabledAgents(filteredOpencodeGlobalAgents),
      ...filterDisabledAgents(filteredProjectAgents),
      ...filterDisabledAgents(filteredOpencodeProjectAgents),
      ...filterDisabledAgents(filteredAgentDefinitionAgents),
      ...filterDisabledAgents(filteredOpencodeConfigAgents),
      ...filteredConfigAgents,
      build: { ...migratedBuild, mode: "subagent", hidden: true },
    };
  } else {
    const protectedBuiltinAgentNames = createProtectedAgentNameSet(
      Object.keys(builtinAgents),
    );
    const filteredUserAgents = filterProtectedAgentOverrides(
      userAgents,
      protectedBuiltinAgentNames,
    );
    const filteredProjectAgents = filterProtectedAgentOverrides(
      projectAgents,
      protectedBuiltinAgentNames,
    );
    const filteredPluginAgents = filterProtectedAgentOverrides(
      pluginAgents,
      protectedBuiltinAgentNames,
    );
    const filteredOpencodeGlobalAgents = filterProtectedAgentOverrides(
      opencodeGlobalAgents,
      protectedBuiltinAgentNames,
    );
    const filteredOpencodeProjectAgents = filterProtectedAgentOverrides(
      opencodeProjectAgents,
      protectedBuiltinAgentNames,
    );
    const filteredAgentDefinitionAgents = filterProtectedAgentOverrides(
      agentDefinitionAgents,
      protectedBuiltinAgentNames,
    );
    const filteredOpencodeConfigAgents = filterProtectedAgentOverrides(
      opencodeConfigAgents,
      protectedBuiltinAgentNames,
    );

    const defaultedConfigAgents = configAgent
      ? Object.fromEntries(
          Object.entries(configAgent)
            .filter(([key]) => key !== "plan")
            .map(([key, value]) => {
            if (!value) return [key, value];
            const migrated = migrateAgentConfig(value as Record<string, unknown>);
            if (!migrated.mode) migrated.mode = "subagent";
            return [key, migrated];
          }),
        )
      : {};

    params.config.agent = {
      ...builtinAgents,
      // Precedence: later entries override earlier (project > global > user > plugin)
      ...filterDisabledAgents(filteredPluginAgents),
      ...filterDisabledAgents(filteredUserAgents),
      ...filterDisabledAgents(filteredOpencodeGlobalAgents),
      ...filterDisabledAgents(filteredProjectAgents),
      ...filterDisabledAgents(filteredOpencodeProjectAgents),
      ...filterDisabledAgents(filteredAgentDefinitionAgents),
      ...filterDisabledAgents(filteredOpencodeConfigAgents),
      ...defaultedConfigAgents,
    };
  }

  if (params.config.agent) {
    params.config.agent = remapAgentKeysToDisplayNames(
      params.config.agent as Record<string, unknown>,
    );
    params.config.agent = reorderAgentsByPriority(
      params.config.agent as Record<string, unknown>,
    );

    const normalizedAgents = params.config.agent as Record<string, unknown>;
    for (const name of CANONICAL_VISIBLE_AGENT_NAMES) {
      if (name in normalizedAgents) {
        normalizedAgents[name] = forceVisiblePrimaryAgent(
          normalizedAgents[name],
          name,
          name === "Bob" ? "primary" : "all",
        );
      }
    }

    for (const hiddenName of ["Agent Skills", "Quality Guardian", "Sub"] as const) {
      if (hiddenName in normalizedAgents) {
        normalizedAgents[hiddenName] = forceHiddenCompatibilityAgent(
          normalizedAgents[hiddenName],
          hiddenName,
        );
      }
    }

    normalizedAgents["build"] = {
      name: "build",
      mode: "subagent",
      hidden: true,
    };
    normalizedAgents["plan"] = {
      name: "plan",
      mode: "subagent",
      hidden: true,
    };
  }

  const agentResult = params.config.agent as Record<string, unknown>;
  for (const name of Object.keys(agentResult)) {
    registerAgentName(name);
  }
  log("[config-handler] agents loaded", { agentKeys: Object.keys(agentResult) });
  return agentResult;
}
