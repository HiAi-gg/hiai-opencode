import type {
  AvailableAgent,
  AvailableCategory,
  AvailableSkill,
} from "./dynamic-agent-prompt-types"

export function buildHardBlocksSection(): string {
  const blocks = [
    "- Type error suppression (`as any`, `@ts-ignore`) - **Never**",
    "- Commit without explicit request - **Never**",
    "- Speculate about unread code - **Never**",
    "- Leave code in broken state after failures - **Never**",
    "- `background_cancel(all=true)` - **Never.** Always cancel individually by taskId.",
    "- Delivering final answer before collecting Critic result when a review gate was requested - **Never.**",
  ]

  return `## Hard Blocks (NEVER violate)

${blocks.join("\n")}`
}

export function buildAntiPatternsSection(): string {
  const patterns = [
    "- **Type Safety**: `as any`, `@ts-ignore`, `@ts-expect-error`",
    "- **Error Handling**: Empty catch blocks `catch(e) {}`",
    '- **Testing**: Deleting failing tests to "pass"',
    "- **Search**: Firing agents for single-line typos or obvious syntax errors",
    "- **Debugging**: Shotgun debugging, random changes",
    "- **Background Tasks**: Polling `background_output` on running tasks - end response and wait for notification",
    "- **Delegation Duplication**: Delegating research to researcher and then manually doing the same search yourself",
    "- **Critic**: Delivering answer without collecting Critic results when a review gate was requested",
  ]

  return `## Anti-Patterns (blocking violations)

${patterns.join("\n")}`
}

export function buildHardRulesSection(): string {
  return buildHardBlocksSection() + "\n\n" + buildAntiPatternsSection()
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
## Anti-Duplication Rule

Once you delegate research to researcher, **DO NOT perform the same search yourself**.

### What this means:

**FORBIDDEN:**
- After firing researcher, manually grep/search for the same information
- Re-doing the research the agents were just tasked with
- "Just quickly checking" the same files the background agents are checking

**ALLOWED:**
- Continue with **non-overlapping work** - work that doesn't depend on the delegated research
- Work on unrelated parts of the codebase
- Preparation work (e.g., setting up files, configs) that can proceed independently

### Wait for Results Properly:

When you need the delegated results but they're not ready:

1. **End your response** - do NOT continue with work that depends on those results
2. **Wait for the completion notification** - the system will trigger your next turn
3. **Then** collect results via \`background_output(task_id="...")\`
4. **Do NOT** impatiently re-search the same topics while waiting

### Example:

\`\`\`typescript
// WRONG: After delegating, re-doing the search
task(subagent_type="researcher", run_in_background=true, ...)
// Then immediately grep for the same thing yourself - FORBIDDEN

// CORRECT: Continue non-overlapping work
task(subagent_type="researcher", run_in_background=true, ...)
// Work on a different, unrelated file while they search
// End your response and wait for the notification
\`\`\`
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
