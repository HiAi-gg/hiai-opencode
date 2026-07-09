# Permissions & Gate Model

hiai-opencode implements a multi-layer permission system to control agent actions.

## Layer 1 — Legal Gate (Hard Deny + Contextual Deny)

File: `src/hooks/legal-gate.ts` (registered as `legal-gate` named hook in the hook system)

### Hard Deny List
Always blocks, regardless of context:

| Category | Patterns | Reason |
|----------|----------|--------|
| Military | weapon, drone-strike, missile, ballistic + targeting verbs | Project ethical-use policy |
| Ransomware | ransomware, ransom-note, encrypt+files+payload | Malicious cyber activity |
| Credential theft | credential-harvest, stealer-log, password-dump, lsass-dump | Credential theft prohibited |
| C2/Botnet | cnc-server, botnet | C2 infrastructure prohibited |
| Exfiltration | exfiltrate, smuggle-data, covert-channel | Unauthorized data exfiltration |
| PII scraping | scrape/harvest + personal-data/PII + without consent | Privacy violation |

### Contextual Deny
Only blocks when paired with offensive-intent verbs (attack, compromise, weaponize,
exploit, backdoor, hack, etc.):

| Pattern | Example legitimate use (allowed) |
|---------|----------------------------------|
| SQL injection, XSS, 0-day | `"fix the SQL injection in login form"` |
| Phishing | `"audit email templates for phishing risk"` |
| C2, command-and-control | `"review C2 traffic patterns in the SIEM"` |

### How it works

1. Every `tool.execute.before` call is intercepted.
2. `JSON.stringify(args)` is tested against hard-deny patterns.
3. If no hard match, dual-use patterns are checked. Only blocked if an
   offensive-intent verb is ALSO present in the same args string.
4. If matched, throws `Error` — the tool call never reaches the native permission system.

## Layer 2 — Defense-in-Depth: Read-Only external_directory Auto-Allow

When the `permission.ask` hook receives a request where the permission is
`external_directory` AND the tool being called is read-only, the hook
automatically sets `output.status = "allow"` without prompting the user.

Read-only tool allowlist:
- `read`, `grep`, `glob`, `list`
- `lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`
- `hiai_memory_search`
- `session_read`, `session_search`, `session_info`

The following tools are **NOT** auto-allowed for `external_directory` — they
fall through to the standard ask/deny logic:
- `bash`, `write`, `edit`, `patch`, `apply_patch`, `multiedit`, `webfetch`
- All browser automation tools (agent_browser_*)
- All firecrawl tools (firecrawl_*)

This is defense-in-depth: the per-agent permission system (Layer 3) is the
primary control. This hook only catches fallthrough cases.

## Layer 3 — Ask-Before-Do (permission.ask)

High-risk tools always request human permission via the `permission.ask` hook:

- `bash` — Shell execution
- `write` — File writing
- `edit` — File editing
- `patch` / `apply_patch` — Applying patches
- `multiedit` — Multi-file edits
- `webfetch` — External HTTP requests

This is implemented in `legal-gate.ts` as a `permission.ask` hook that sets
`output.status = "ask"` for these tools. The native OpenCode permission
system handles the actual allow/deny UI.

## Layer 4 — Per-Agent Restrictions (`bob.json`)

File: `src/config.ts` → `agent_restrictions`

Default restrictions (using internal runtime slot names — `build` = Coder, `plan` = Strategist, `explore` = Explorer):

```jsonc
{
  "agent_restrictions": {
    "bob": {
      "write": false,     // Bob never mutates files
      "edit": false,
      "bash": false,      // No shell
      "apply_patch": false,
      "grep": false,      // No direct grep
      "glob": false
    },
    "plan": {
      "bash": false,      // No shell
      "grep": false,
      "glob": false,
      "webfetch": false
    },
    "critic": {
      "write": false,     // Read-only
      "edit": false
    },
    "explore": {
      "write": false,     // Read-only
      "edit": false
    },
    "general": {
      "task": false       // Cannot create tasks
    }
  }
}
```

When a restriction key is set to `false`:
- For **permission keys** (edit, bash, webfetch, doom_loop, external_directory):
  the plugin sets `permission.<key> = "deny"` on the agent config.
- For **tool keys** (write, grep, glob, task, apply_patch): the plugin sets
  `tools.<key> = false` to disable the tool for that agent.

Overridable in user's `bob.json`.

### Cross-Project Inspection (external_directory)

Internal agents that perform cross-project file inspection receive
`permission.external_directory = "allow"` by default. This prevents them from
hanging on native `external_directory` permission prompts when reading files
outside the project root:

| Agent      | external_directory | Why |
|------------|-------------------|-----|
| explore    | `allow` | Deep codebase exploration |
| plan       | `allow` | Architecture analysis |
| critic     | `allow` | Code review across projects |
| build      | `allow` | Implementation referencing external code |
| general    | `allow` | General-purpose cross-project work |
| manager    | `allow` | Coordination across projects |
| writer     | `allow` | Documentation referencing external code |
| designer   | `allow` | Design system referencing external code |
| **bob**    | **not set** | Bob delegates discovery to **explore** |
| **vision** | **not set** | Browser/multimodal only; no file access needed |

> **Why Bob and Vision are excluded**:
> - **Bob** is the orchestrator — it should delegate file discovery and
>   exploration to the **explore** agent rather than reading files directly.
> - **Vision** is browser/multimodal only — it does not need file system access.

To disable cross-project access for a specific agent, set
`agent_restrictions.<agent>.external_directory = false` in `bob.json`:

```jsonc
{
  "agent_restrictions": {
    "explore": {
      "external_directory": false,  // revoke cross-project access
      "write": false,
      "edit": false
    }
  }
}
```

> **Security note**: `external_directory: "allow"` permits file access outside
> the project root. Per-agent restrictions (write, edit, bash, etc.) are still
> enforced independently via `agent_restrictions` (see the table in Layer 4).
> Bob and Plan retain their grep/glob/webfetch restrictions — direct
> discovery is not permitted; use the **explore** agent instead.

## Layer 5 — Hooks Disabling

Hooks can be individually disabled in `bob.json`:

```jsonc
{
  "hooks": {
    "disabled": ["legal-gate", "non-interactive-env", "write-existing-file-guard"]
  }
}
```

## Layer 6 — Agent Overrides

Individual agent models and prompt appends:

```jsonc
{
  "agent_overrides": {
    "bob": {
      "model": "custom-provider/custom-model",
      "prompt_append": "Always prefer the fastest model for simple questions."
    },
    "build": {
      "prompt_append": "Run `bun run typecheck` before declaring success."
    }
  }
}
```

## Summary

```
User Input → Legal Gate (hard deny)
           → Legal Gate (contextual deny if offensive intent)
           → Legal Gate — defense-in-depth (auto-allow read-only external_directory)
           → Legal Gate — ask-before-do (high-risk tools → human permission)
           → Per-agent restrictions (denied tools/permissions)
           → Native OpenCode permission system
           → Tool executes (or blocked)
```
