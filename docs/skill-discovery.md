# Skill Discovery

Skill discovery controls which folders OpenCode scans for skill definitions. Skills are `.md` files under known directories that provide specialized instructions for agent tasks.

## Source Files

- **Schema**: `src/config/schema/skill-discovery.ts`
- **Routing logic**: `src/plugin/skill-context.ts`
- **Config resolution**: `src/plugin/skill-discovery-config.ts`

## Configuration Options

The `skill_discovery` object accepts 7 independent boolean flags. All default to safe, reproducible values.

```typescript
interface SkillDiscoveryConfig {
  config_sources: boolean   // default: true
  project_opencode: boolean // default: true
  global_opencode: boolean // default: false
  project_claude: boolean  // default: false
  global_claude: boolean   // default: false
  project_agents: boolean  // default: false
  global_agents: boolean   // default: false
}
```

| Option | Default | Scanned folder | When to enable |
|--------|---------|----------------|----------------|
| `config_sources` | `true` | `hiai-opencode`-bundled skills + explicit `skills.sources` entries in config | Always on — this is the plugin's own skill library |
| `project_opencode` | `true` | `.opencode/skills/` in project root | Project-local skills shipped with this repo. Safe to keep on. |
| `global_opencode` | `false` | `~/.config/opencode/skills/` | Global OpenCode skill library. Enable if you want OpenCode's community skill collection. |
| `project_claude` | `false` | `.claude/skills/` at project root | Project-level Claude-coded skills. Disabled to avoid mixing Codex/Claude skill collections. |
| `global_claude` | `false` | `~/.claude/skills/` | Global Claude skill library. Disabled to keep installs clean. |
| `project_agents` | `false` | `agents/` at project root | Project-level Agents skills. Disabled to avoid accidental pollution from unrelated agent definitions. |
| `global_agents` | `false` | `~/.agents/skills/` | Global Agents skill library. Disabled to keep installs reproducible. |

### Default (deterministic)

```json
{
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": true,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

This is the recommended configuration. It loads hiai-opencode bundled skills, generated builtin helpers (browser, review, git, etc.), explicit config sources, and project-local `.opencode/skills`. No external skill collections are mixed in.

## Preset Variant Combinations

The four named variants below are **convenience presets** — combinations of the 7 boolean flags that produce specific behaviors. They are not separate enum values in the schema; you set the individual flags to achieve each effect.

### `all` — Load Everything

Loads hiai-opencode skills plus every external skill folder. Useful when exploring what's available or migrating from another setup.

```json
{
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": true,
    "global_opencode": true,
    "project_claude": true,
    "global_claude": true,
    "project_agents": true,
    "global_agents": true
  }
}
```

**When to use**: Initial exploration, comparing skill quality across sources, or when you have a curated global collection you want to expose.

**Performance implications**: Highest startup cost. Every configured skill folder is scanned. If global folders contain hundreds of skills, OpenCode prompt context warm-up is measurably slower. Also increases the chance of skill name collisions or contradictory skill behaviors.

---

### `minimal` — Only Built-in Skills

Loads only `config_sources` (hiai-opencode bundled skills and generated builtin helpers). No project-local or external folders.

```json
{
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": false,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

**When to use**: Minimalist deployments, CI/build environments where repeatability is paramount, or embedded contexts where external skills would be inappropriate.

**Performance implications**: Lowest startup cost. Only the plugin's internal skill manifests are loaded. Fastest possible skill context initialization. You lose project-local `.opencode/skills` — enable `project_opencode: true` alongside this if you need those.

---

### `registry` — Config Sources Only

Loads skills explicitly listed in `skills.sources` in `hiai-opencode.json`, plus the plugin's built-in skills. No automatic folder scanning beyond what you configure.

```json
{
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": false,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

With a `skills.sources` entry:

```json
{
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": false,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  },
  "skills": {
    "sources": [
      { "path": "/absolute/path/to/my-custom-skill" }
    ]
  }
}
```

**When to use**: When you want explicit, auditable skill sources only. No accidental skill injection from global folders. Each skill is a deliberate `skills.sources` entry.

**Performance implications**: Medium startup cost — proportional to how many explicit `skills.sources` entries you add. No surprise folder scans. Scales with your explicit list, not with global folder contents.

---

### `none` — No Skills Loaded

Disables all skill loading including hiai-opencode's own bundled skills. Agents operate without any skill context.

```json
{
  "skill_discovery": {
    "config_sources": false,
    "project_opencode": false,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

**When to use**: Rare. Troubleshooting skill-related issues, forced zero-context prompts, or embedding the plugin without its skill infrastructure.

**Performance implications**: Minimal memory footprint for skills. However, agents lose access to all bundled skill instructions (`agent-browser`, `frontend-ui-ux`, `review-work`, `git-master`, etc.). This will degrade any workflow that depends on those skills.

## Per-Skill Disable

To disable individual skills without changing folder scanning, use `skills.disable`:

```json
{
  "skills": {
    "disable": ["claude-md-management", "some-noisy-skill"]
  }
}
```

This filters skills by name after folder scanning is complete, regardless of which variant or flag combination is used.

## Examples in opencode.json

### Minimal (recommended baseline)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"],
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": true,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

### All external sources enabled

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"],
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": true,
    "global_opencode": true,
    "project_claude": true,
    "global_claude": true,
    "project_agents": true,
    "global_agents": true
  }
}
```

### Registry-style with explicit sources only

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"],
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": false,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  },
  "skills": {
    "sources": [
      { "path": "/home/user/.config/opencode/skills/my-custom-skill" }
    ]
  }
}
```

### Zero skills (debug/troubleshoot)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"],
  "skill_discovery": {
    "config_sources": false,
    "project_opencode": false,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

## Quick Reference

| Variant | config_sources | project_opencode | global_opencode | project_claude | global_claude | project_agents | global_agents |
|---------|---------------|-----------------|----------------|---------------|--------------|---------------|--------------|
| **default** | true | true | false | false | false | false | false |
| **all** | true | true | true | true | true | true | true |
| **minimal** | true | false | false | false | false | false | false |
| **registry** | true | false | false | false | false | false | false |
| **none** | false | false | false | false | false | false | false |

## Mapping: Config Flags to Skill Loader Scopes

The 7 config flags map to the 4 internal scopes used by the skill loader. Multiple flags can collapse into a single scope when they share the same priority level.

| Skill Loader Scope | Priority | Config Flags That Control It |
|---|---|---|
| **Project** (`.opencode/skills/`) | 1 (highest) | `project_opencode` |
| **OpenCode config** (`~/.config/opencode/skills/`) | 2 | `global_opencode` |
| **User** (`~/.config/opencode/hiai-opencode/skills/`) | 3 | `config_sources` (includes bundled skills + explicit `skills.sources`) |
| **Global** (built-in skills) | 4 (lowest) | `config_sources` (always includes plugin built-ins when true) |

Additional flags `project_claude`, `global_claude`, `project_agents`, and `global_agents` add scanned folders that merge into the **Global** scope at the lowest priority. Same-named skills from higher-priority scopes override lower ones.