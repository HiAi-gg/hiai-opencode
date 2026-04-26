export const DOCTOR_TEMPLATE = `# Hiai OpenCode Doctor Command

## Purpose

Use /doctor to run the hiai-opencode install/runtime diagnostic and report actionable setup issues.

## Execute

Run:

\`\`\`bash
hiai-opencode doctor
\`\`\`

If the binary is not on PATH, try the package-local fallback:

\`\`\`bash
node ./node_modules/@hiai-gg/hiai-opencode/assets/cli/hiai-opencode.mjs doctor
\`\`\`

## Report

Summarize:

- config path
- enabled and disabled MCP servers
- missing env vars by name only
- static \`.mcp.json\` freshness and whether it is managed by hiai-opencode
- OpenCode Connect visibility for configured model providers
- OpenCode plugin registration sanity (including \`plugin: ["list"]\` misconfiguration warning)
- skill materialization status from skill registry
- agent count and naming summary
- LSP runtime availability
- MemPalace python source and selected interpreter (env/config/auto)
- MCP tool probes (real connect + tools/list) for stdio and basic endpoint probes for remote MCP

Rules:

- Do not print API key values.
- Do not ask for model provider env vars such as OPENROUTER_API_KEY or OPENAI_API_KEY; normal model auth belongs to OpenCode Connect.
- If \`opencode mcp list\` is empty but doctor/mcp-status sees servers, explain the runtime-vs-static config distinction and run \`hiai-opencode export-mcp .mcp.json\` if the user wants static visibility.
- Do not run package installs unless the user explicitly asks.
`
