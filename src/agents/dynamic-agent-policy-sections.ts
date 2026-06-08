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

export function buildAntiDuplicationSection(): string {
  return `<Anti_Duplication>
Once you delegate research, **DO NOT re-search the same topic yourself**. Continue non-overlapping work only. If you need delegated results but they are not ready: end your response and wait for the completion notification, then collect via \`background_output(task_id="...")\`.
</Anti_Duplication>`
}
