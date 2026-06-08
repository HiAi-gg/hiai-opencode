import type {
  AvailableAgent,
  AvailableCategory,
  AvailableSkill,
} from "./dynamic-agent-prompt-types"

export function buildHardBlocksSection(): string {
  const blocks = [
    "- Type error suppression (`as any`, `@ts-ignore`) — **Never**",
    "- Commit without explicit request — **Never**",
    "- Speculate about unread code — **Never**",
    "- Leave code broken after failures — **Never**",
    "- `background_cancel(all=true)` — **Never.** Cancel individually by taskId.",
    "- Final answer before collecting Critic result when review gate requested — **Never**",
  ]

  return `## Hard Blocks (NEVER)
${blocks.join("\n")}`
}

export function buildAntiPatternsSection(): string {
  const patterns = [
    "**Type Safety**: `as any`, `@ts-ignore`, `@ts-expect-error`",
    "**Error Handling**: empty catch blocks `catch(e) {}`",
    "**Testing**: deleting failing tests to \"pass\"",
    "**Search**: firing agents for single-line typos or obvious syntax errors",
    "**Debugging**: shotgun debugging, random changes",
    "**Background Tasks**: polling `background_output` on running tasks — end response, wait for notification",
    "**Delegation Duplication**: delegating to researcher then re-searching the same topic yourself",
    "**Critic**: delivering answer without collecting Critic results when review gate requested",
  ]

  return `## Anti-Patterns (blocking)
${patterns.join("\n")}`
}

export function buildDelegationWarningSection(): string {
  return `## ⛔ Delegation Required — Before Code
1. Specialized agent for this? → \`task()\` to delegate
2. UI/visual/frontend? → \`task(category='visual-engineering', load_skills=['frontend-ui-ux'])\` → Designer
3. Architecture/system design/dependencies? → \`task(subagent_type='manager', load_skills=['api-and-interface-design'])\` → Manager
4. 5+ todo items OR 3+ parallel work units? → \`task(subagent_type='manager', ...)\` → Manager for wave-based orchestration
5. Trivial (single line, obvious fix)? → Direct
**Default: DELEGATE. Work yourself only when super simple.**`
}

export function buildHardRulesSection(): string {
  return (
    buildHardBlocksSection() +
    "\n\n" +
    buildAntiPatternsSection() +
    "\n\n" +
    buildDelegationWarningSection()
  )
}

export function buildToolCallFormatSection(): string {
  return `## Tool Call Format

**ALWAYS use the native tool calling mechanism. NEVER output tool calls as text.**

When you need to call a tool:
1. Use the tool call interface provided by the system
2. Do NOT write tool calls as plain text like \`assistant to=functions.XXX\`
3. Do NOT output JSON directly in your text response
4. The system handles tool call formatting automatically

**CORRECT**: Invoke the tool through the tool call interface
**WRONG**: Writing \`assistant to=functions.todowrite\` or \`json\n{...}\` as text

Your tool calls are processed automatically. Just invoke the tool - do not format the call yourself.`
}

export function buildUltraworkSection(
  agents: AvailableAgent[],
  categories: AvailableCategory[],
  skills: AvailableSkill[],
): string {
  const lines: string[] = []

  if (categories.length > 0) {
    lines.push("**Categories** (for implementation tasks):")
    for (const category of categories) {
      const shortDescription = category.description || category.name
      lines.push(`- \`${category.name}\`: ${shortDescription}`)
    }
    lines.push("")
  }

  if (skills.length > 0) {
    const builtinSkills = skills.filter((skill) => skill.location === "plugin")
    const customSkills = skills.filter((skill) => skill.location !== "plugin")

    if (builtinSkills.length > 0) {
      lines.push("**Built-in Skills** (combine with categories):")
      for (const skill of builtinSkills) {
        const shortDescription = skill.description.split(".")[0] || skill.description
        lines.push(`- \`${skill.name}\`: ${shortDescription}`)
      }
      lines.push("")
    }

    if (customSkills.length > 0) {
      lines.push("**User-Installed Skills** (HIGH PRIORITY - user installed these for their workflow):")
      for (const skill of customSkills) {
        const shortDescription = skill.description.split(".")[0] || skill.description
        lines.push(`- \`${skill.name}\`: ${shortDescription}`)
      }
      lines.push("")
    }
  }

  if (agents.length > 0) {
    const ultraworkAgentPriority = ["researcher", "strategist", "critic"]
    const sortedAgents = [...agents].sort((left, right) => {
      const leftIndex = ultraworkAgentPriority.indexOf(left.name)
      const rightIndex = ultraworkAgentPriority.indexOf(right.name)
      if (leftIndex === -1 && rightIndex === -1) {
        return 0
      }
      if (leftIndex === -1) {
        return 1
      }
      if (rightIndex === -1) {
        return -1
      }
      return leftIndex - rightIndex
    })

    lines.push("**Agents** (for specialized consultation and research):")
    for (const agent of sortedAgents) {
      const shortDescription =
        agent.description.length > 120
          ? `${agent.description.slice(0, 120)}...`
          : agent.description
      const suffix =
        agent.name === "researcher" ? " (multiple/background)" : ""
      lines.push(`- \`${agent.name}${suffix}\`: ${shortDescription}`)
    }
  }

  return lines.join("\n")
}

export function buildAntiDuplicationSection(): string {
  return `<Anti_Duplication>
Once you delegate research, **DO NOT re-search the same topic yourself**. Continue non-overlapping work only. If you need delegated results but they are not ready: end your response and wait for the completion notification, then collect via \`background_output(task_id="...")\`.
</Anti_Duplication>`
}

export function buildToolUsageRulesSection(): string {
  return `<tool_usage_rules>
- Parallelize independent tool calls: multiple file reads, grep searches, agent fires - all at once
- Researcher = background grep. ALWAYS \`run_in_background=true\`, ALWAYS parallel
- Fire 2-5 researcher agents in parallel for any non-trivial codebase question
- Parallelize independent file reads - don't read files one at a time
- After any write/edit tool call, briefly restate what changed, where, and what validation follows
- Prefer tools over internal knowledge whenever you need specific data (files, configs, patterns)
</tool_usage_rules>`;
}

export function buildMemorySection(): string {
  return `### Memory (MemPalace)

Before starting work, search MemPalace for relevant past decisions. After completing significant work, record outcomes via \`mempalace_diary_write\`.`;
}
