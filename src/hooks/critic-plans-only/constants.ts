import { createSystemDirective, SystemDirectiveTypes } from "../../shared/system-directive"
import { getAgentDisplayName } from "../../shared/agent-display-names"

export const HOOK_NAME = "critic-plans-only"
export const CRITIC_AGENT = "critic"
export const ALLOWED_EXTENSIONS = [".md"]
export const ALLOWED_PATH_PREFIX = ".bob/plans"

export const BLOCKED_TOOLS = [
  "Write", "write",
  "bash", "Bash",
  "apply_patch",
  "ast_grep_replace",
  "hashline_edit",
  "interactive_bash",
]

export const CRITIC_EDIT_PERMISSION_REMINDER = `

---

${createSystemDirective(SystemDirectiveTypes.STRATEGIST_READ_ONLY)}

## CRITIC EDIT PERMISSION — STRICT BOUNDARY

You have been granted the \`edit\` tool for a SINGLE purpose: marking plan checkboxes.

**ALLOWED:**
- \`edit\` on \`.bob/plans/*.md\` files ONLY — to toggle \`- [ ]\` → \`- [x]\` when verification passes

**FORBIDDEN:**
- \`edit\` on ANY file outside \`.bob/plans/\`
- \`write\`, \`bash\`, \`apply_patch\`, \`ast_grep_replace\`, \`hashline_edit\`
- ANY code changes, source modifications, or file creation outside plan files

**VIOLATION**: editing any non-plan file will be BLOCKED by the runtime guard.

---
`