# start.md — Installing @hiai-gg/hiai-opencode on a Clean Machine

This guide installs OpenCode from scratch and connects the `@hiai-gg/hiai-opencode` plugin.

---

## 1. Prerequisites

```bash
# Bun (required — OpenCode runtime)
curl -fsSL https://bun.sh/install | bash

# Node 20+ (for npm global install)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 20

# Git
sudo apt install git   # Debian/Ubuntu
# or: brew install git # macOS
```

Verify:

```bash
bun --version   # >= 1.3.0
node --version  # >= 20
git --version
```

---

## 2. Install OpenCode

```bash
npm install -g opencode-ai
opencode --version
```

OpenCode config lives at `~/.config/opencode/`.

---

## 3. Install the Plugin

### Option A — npm (once published)

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Or manually:

```bash
cd ~/.config/opencode
npm install @hiai-gg/hiai-opencode
```

### Option B — GitHub (current path)

```bash
cd ~/.config/opencode
npm install github:HiAi-gg/hiai-opencode
```

### Option C — Local dev link

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git ~/src/hiai-opencode
cd ~/src/hiai-opencode
bun install
bun run build
npm link
cd ~/.config/opencode
npm link @hiai-gg/hiai-opencode
```

---

## 4. Enable the Plugin

Create or edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

Override agent models in `hiai-opencode.json` (project root or `.opencode/`):

```json
{
  "models": {
    "build": "anthropic/claude-opus-4",
    "general": "anthropic/claude-haiku-4"
  }
}
```

> **Legacy name support**: `coder`→`build`, `strategist`→`plan`, `researcher`→`explore`, `sub`→`general` are automatically resolved.

Full reference: [`config/hiai-opencode.schema.json`](config/hiai-opencode.schema.json).

---

## 5. Verify

```bash
cd /tmp && mkdir oc-test && cd oc-test
opencode
```

Inside the session, run `/agents`. You should see 9 visible agents:

| Agent (display) | Runtime slot | Role |
|-----------------|-------------|------|
| `Bob` | bob | Orchestrator, router |
| `Coder` | build | Deep implementation |
| `Strategist` | plan | Planning, architecture |
| `Explorer` | explore | Local + external search |
| `Manager` | manager | Delegation orchestrator, TODO tracker |
| `Critic` | critic | Review gate |
| `Designer` | designer | UI/visual direction |
| `Writer` | writer | Content, copy, SEO |
| `Vision` | vision | PDF/image extraction, browser verification |

> **Note**: Runtime config keys differ from display names. `build` = Coder, `plan` = Strategist, `explore` = Explorer, `general` = General (hidden fallback). Legacy `coder`/`strategist`/`researcher`/`sub` names are preserved as compatibility aliases.

### CLI diagnostics

```bash
hiai-opencode doctor
hiai-opencode mcp-status
opencode debug config
```

If agents are missing:

```bash
ls ~/.config/opencode/node_modules/@hiai-gg/hiai-opencode/dist/index.js
# must exist; re-install if not
```

---

## 6. Optional — Isolated Sandbox

```bash
mkdir -p ~/oc-sandbox && cd ~/oc-sandbox
npm install @hiai-gg/hiai-opencode
# create minimal opencode.json with "plugin": ["@hiai-gg/hiai-opencode"]
OPENCODE_CONFIG=~/oc-sandbox/opencode.json opencode
```

---

## 7. Updating

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
# or: cd ~/.config/opencode && npm update @hiai-gg/hiai-opencode
```

Restart any active OpenCode session.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `plugin not found` | Ensure `node_modules/@hiai-gg/hiai-opencode/dist/index.js` exists |
| Agents missing | Restart OpenCode; check `opencode.json` has the plugin entry |
| `SyntaxError` on load | Bun >= 1.3.0 required |
| MCP servers fail | Check `hiai-opencode mcp-status`; set required env vars |
| LSP features missing | OpenCode's built-in LSP wiring handles this |
| `hiai-opencode` CLI not found | Run `npm link` from the plugin dir, or `npx hiai-opencode doctor` |

---

## 9. Uninstall

```bash
opencode plugin @hiai-gg/hiai-opencode --remove --global
# or: cd ~/.config/opencode && npm uninstall @hiai-gg/hiai-opencode
```

Remove the `"plugin"` line from `opencode.json`.

---

## Reference Docs

- [README.md](README.md) — overview, agents, modes, integrations
- [AGENTS.md](AGENTS.md) — agent/tooling operator instructions
- [ARCHITECTURE.md](ARCHITECTURE.md) — internals and modification map
- [CONTRIBUTING.md](CONTRIBUTING.md) — contributor guide
- [CHANGELOG.md](CHANGELOG.md) — release history
- [SECURITY.md](SECURITY.md) — security policy
- [LICENSE.md](LICENSE.md) — MIT license
