export const PRIMARY_ALLOWED_AGENTS = [
  "researcher",
  "strategist",
  "coder",
  "critic",
  "designer",
  "brainstormer",
  "platform-manager",
  "multimodal",
] as const

export const ALLOWED_AGENTS = [
  ...PRIMARY_ALLOWED_AGENTS,
] as const

export const CALL_OMO_AGENT_DESCRIPTION = `Spawn canonical agents or custom agents. run_in_background REQUIRED (true=async with task_id, false=sync).

Canonical built-in agents:
{primary_agents}

Custom agents registered via user or project agent directories are also supported.

Pass \`session_id=<id>\` to continue previous agent with full context. Nested subagent depth is tracked automatically and blocked past the configured limit. Prompts MUST be in English. Use \`background_output\` for async results.`
