# start.md — Installing hiai-opencode on a Clean Machine

This guide installs OpenCode from scratch and connects the `hiai-opencode` plugin on a new PC.

---

## 1. Prerequisites

Install these first:

```bash
# Bun (required — OpenCode runtime)
curl -fsSL https://bun.sh/install | bash

# Node 18+ (for npm publish/install compatibility)
# Use your OS package manager, or nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 20

# Git
sudo apt install git   # Debian/Ubuntu
# or: brew install git # macOS
```

Verify:

```bash
bun --version   # ≥ 1.1.0
node --version  # ≥ 18
git --version
```

---

## 2. Install OpenCode

```bash
# Recommended: npm global install
npm install -g opencode-ai

# Verify
opencode --version
```

OpenCode config lives at `~/.config/opencode/`.

---

## 3A. Install `hiai-opencode` Plugin — From npm (once published)

```bash
cd ~/.config/opencode
npm install hiai-opencode
```

This places the package under `~/.config/opencode/node_modules/hiai-opencode/`.

## 3B. Install `hiai-opencode` Plugin — From GitHub (current path)

Until the package is published to npm, install directly from the GitHub release:

```bash
cd ~/.config/opencode
npm install github:HiAi-gg/hiai-opencode
```

Or clone + link for local development:

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git ~/src/hiai-opencode
cd ~/src/hiai-opencode
bun install
bun run build
npm link
cd ~/.config/opencode
npm link hiai-opencode
```

---

## 4. Enable the Plugin in `opencode.json`

Create or edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["hiai-opencode"]
}
```

That single line registers every agent, MCP server, hook, skill, and permission that the plugin ships.

**Optional** — override agent models, permissions, or MCPs by adding fields per the schema at
[`config/hiai-opencode.schema.json`](config/hiai-opencode.schema.json). Example:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["hiai-opencode"],
  "hiai-opencode": {
    "agents": {
      "coder": { "model": "anthropic/claude-opus-4" },
      "sub":   { "model": "anthropic/claude-haiku-4" }
    }
  }
}
```

A richer, working reference config is in [`hiai-opencode.json`](hiai-opencode.json).

---

## 5. Verify the Plugin Loaded

```bash
cd /tmp && mkdir oc-test && cd oc-test
opencode
```

Inside the OpenCode session, run:

```
/agents
```

You should see the canonical 12 agents:
`bob, guard, strategist, critic, coder, sub, researcher, multimodal, quality-guardian, platform-manager, brainstormer, agent-skills`.

If agents are missing, check:

```bash
ls ~/.config/opencode/node_modules/hiai-opencode/dist/index.js
# → must exist; re-run `npm install hiai-opencode` if not
```

Tail logs if startup fails:

```bash
opencode 2>&1 | tee /tmp/opencode.log
```

---

## 6. Optional — Isolated Sandbox (doesn't touch your main setup)

Run OpenCode with a separate config directory to test the plugin without disturbing your real install:

```bash
mkdir -p ~/oc-sandbox
cp ~/.config/opencode/opencode.json ~/oc-sandbox/opencode.json  # or create minimal
cd ~/oc-sandbox
npm install hiai-opencode   # or: npm link hiai-opencode
OPENCODE_CONFIG=~/oc-sandbox/opencode.json opencode
```

---

## 7. Updating

```bash
cd ~/.config/opencode
npm update hiai-opencode
```

Or for GitHub-installed:

```bash
npm install github:HiAi-gg/hiai-opencode
```

Restart any active OpenCode session to pick up the new build.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `plugin not found: hiai-opencode` | Ensure `node_modules/hiai-opencode/dist/index.js` exists under your OpenCode config dir |
| Agents missing after install | Restart OpenCode; check `opencode.json` has `"plugin": ["hiai-opencode"]` |
| `SyntaxError` on load | Bun ≥ 1.1.0 required; re-run `bun --version` |
| MCP servers fail | See `assets/mcp/` and your OpenCode MCP config; docker/firecrawl/playwright may need separate setup |
| LSP features missing | OpenCode's built-in LSP wiring handles this; check `opencode.json` `lsp` block if customized |

---

## 9. Uninstall

```bash
cd ~/.config/opencode
npm uninstall hiai-opencode
# Remove the "plugin" line from opencode.json
```

---

## Reference Docs

- [README.md](README.md) — overview
- [AGENTS_INFO.md](AGENTS_INFO.md) — canonical 12-agent model
- [ARCHITECTURE.md](ARCHITECTURE.md) — package layout
- [REGISTRY.md](REGISTRY.md) — capability registry
- [LICENSE.md](LICENSE.md) — license terms
