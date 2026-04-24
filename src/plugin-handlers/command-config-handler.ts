import type { HiaiOpenCodeConfig } from "../config";
import {
  getAgentConfigKey,
  getAgentListDisplayName,
} from "../shared/agent-display-names";
import {
  loadUserCommands,
  loadProjectCommands,
  loadOpencodeGlobalCommands,
  loadOpencodeProjectCommands,
} from "../features/claude-code-command-loader";
import { loadBuiltinCommands } from "../features/builtin-commands";
import {
  discoverConfigSourceSkills,
  loadManagedPluginSkills,
  loadGlobalAgentsSkills,
  loadProjectAgentsSkills,
  loadUserSkills,
  loadProjectSkills,
  loadOpencodeGlobalSkills,
  loadOpencodeProjectSkills,
  skillsToCommandDefinitionRecord,
} from "../features/opencode-skill-loader";
import {
  detectExternalSkillPlugin,
  getSkillPluginConflictWarning,
  log,
} from "../shared";
import type { PluginComponents } from "./plugin-components-loader";
import { resolveSkillDiscoveryConfig } from "../plugin/skill-discovery-config";

export async function applyCommandConfig(params: {
  config: Record<string, unknown>;
  pluginConfig: HiaiOpenCodeConfig;
  ctx: { directory: string };
  pluginComponents: PluginComponents;
}): Promise<void> {
  const builtinCommands = loadBuiltinCommands(params.pluginConfig.disabled_commands, {
    useRegisteredAgents: true,
  });
  const systemCommands = (params.config.command as Record<string, unknown>) ?? {};

  const includeClaudeCommands = params.pluginConfig.claude_code?.commands ?? true;
  const discovery = resolveSkillDiscoveryConfig(params.pluginConfig);

  const externalSkillPlugin = detectExternalSkillPlugin(params.ctx.directory);
  if (
    (discovery.project_claude || discovery.global_claude || discovery.global_opencode) &&
    externalSkillPlugin.detected
  ) {
    log(getSkillPluginConflictWarning(externalSkillPlugin.pluginName!));
  }

  const [
    configSourceSkills,
    userCommands,
    projectCommands,
    opencodeGlobalCommands,
    opencodeProjectCommands,
    managedPluginSkills,
    userSkills,
    globalAgentsSkills,
    projectSkills,
    projectAgentsSkills,
    opencodeGlobalSkills,
    opencodeProjectSkills,
  ] = await Promise.all([
    discovery.config_sources
      ? discoverConfigSourceSkills({
        config: params.pluginConfig.skills,
        configDir: params.ctx.directory,
      })
      : Promise.resolve([]),
    includeClaudeCommands ? loadUserCommands() : Promise.resolve({}),
    includeClaudeCommands ? loadProjectCommands(params.ctx.directory) : Promise.resolve({}),
    loadOpencodeGlobalCommands(),
    loadOpencodeProjectCommands(params.ctx.directory),
    loadManagedPluginSkills(),
    discovery.global_claude ? loadUserSkills() : Promise.resolve({}),
    discovery.global_agents ? loadGlobalAgentsSkills() : Promise.resolve({}),
    discovery.project_claude ? loadProjectSkills(params.ctx.directory) : Promise.resolve({}),
    discovery.project_agents ? loadProjectAgentsSkills(params.ctx.directory) : Promise.resolve({}),
    discovery.global_opencode ? loadOpencodeGlobalSkills() : Promise.resolve({}),
    discovery.project_opencode ? loadOpencodeProjectSkills(params.ctx.directory) : Promise.resolve({}),
  ]);

  params.config.command = {
    ...builtinCommands,
    ...managedPluginSkills,
    ...skillsToCommandDefinitionRecord(configSourceSkills),
    ...userCommands,
    ...userSkills,
    ...globalAgentsSkills,
    ...opencodeGlobalCommands,
    ...opencodeGlobalSkills,
    ...systemCommands,
    ...projectCommands,
    ...projectSkills,
    ...projectAgentsSkills,
    ...opencodeProjectCommands,
    ...opencodeProjectSkills,
    ...params.pluginComponents.commands,
    ...params.pluginComponents.skills,
  };

  remapCommandAgentFields(params.config.command as Record<string, Record<string, unknown>>);
}

function remapCommandAgentFields(commands: Record<string, Record<string, unknown>>): void {
  for (const cmd of Object.values(commands)) {
    if (cmd?.agent && typeof cmd.agent === "string") {
      cmd.agent = getAgentListDisplayName(getAgentConfigKey(cmd.agent));
    }
  }
}
