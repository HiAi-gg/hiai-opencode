export const MCP_STATUS_TEMPLATE = `# MCP Status Command

## Purpose

Use /mcp-status to show the effective hiai-opencode MCP setup without relying on OpenCode's mcp list output.

## Execute

Run:

\`\`\`bash
hiai-opencode mcp-status
\`\`\`

If the binary is not on PATH, try the package-local fallback:

\`\`\`bash
node ./node_modules/@hiai-gg/hiai-opencode/assets/cli/hiai-opencode.mjs mcp-status
\`\`\`

## Report

Summarize the output in a compact status table:

- MCP server name
- status: ok, warning, error, disabled
- cause or next action

Rules:

- Do not print API key values.
- If a key is missing, name the env var only.
- If a runtime is missing, give the exact install hint from the command output or the shortest safe next command.
- Do not edit config unless the user explicitly asks.
- Do not run package installs unless the user explicitly asks.
`
