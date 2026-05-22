# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within hiai-opencode, please follow our responsible disclosure process:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Send details to the maintainers via private disclosure
3. Include in your report:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested mitigations (optional)

We aim to respond within 48 hours and will work with you on a disclosure timeline.

## Security Considerations

### API Keys and Credentials

- Never commit API keys or credentials to the repository
- Use environment variables or secure secret management
- The plugin uses `{env:VARIABLE_NAME}` placeholder syntax in config files
- Never print, invent, or hardcode secret values

### Model Provider Credentials

Model provider credentials (OpenAI, Anthropic, OpenRouter, etc.) are handled by OpenCode Connect, not by hiai-opencode directly. The plugin only stores model IDs.

### MCP Server Security

- MCP servers run as local processes with access to your system
- Only enable MCP servers you trust
- Review `src/mcp/registry.ts` to understand what each MCP server does
- The plugin does not add MCP server packages to OpenCode plugin array (MCP servers are not plugins)

### Skill Discovery

Global skill folders (OpenCode, Claude, Agents) are disabled by default to keep the skill tree deterministic and prevent accidental code execution from untrusted sources.

### Input Validation

The plugin uses Zod for configuration validation. Never bypass schema validation when making changes.

## Update Policy

Security updates are released as patch versions. Major versions may introduce breaking changes for security reasons.

For questions about security, open a private advisory on the GitHub repository.