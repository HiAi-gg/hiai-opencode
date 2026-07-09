# context7

> **On-demand CLI/skill (context7 is NOT loaded as an MCP server).** Use this
> skill to fetch up-to-date library documentation via the `ctx7` CLI or the
> Context7 HTTP API.

## ⚠️ INVALID COMMAND — NEVER USE

**`ctx7 search` does not exist and will fail.** Never run:

- `npx -y ctx7 search ...`
- `npx ctx7 search ...`
- `ctx7 search ...`

Any command containing `ctx7 search` is invalid. Use only the two-step
`library` → `docs` flow described below.

## When to use

Use this skill when you need **up-to-date documentation for a third-party
library or framework** (library APIs, function signatures, code examples,
version-specific behavior).

Do **not** use it for:

- Local codebase exploration — use the native `grep` / `glob` tools or the
  `explore` agent instead.
- General web search — use `firecrawl` (if available) or your web tools.

## Method 1 — `ctx7` CLI (preferred)

The CLI package is **`ctx7`** (run with `npx -y ctx7`). Fetching docs is two steps:
**resolve the library name → an ID, then query that ID.**

```bash
# Step 1 — resolve a library name to a Context7 ID (format: /org/project).
# Pass a query describing your goal so results rank by relevance.
npx -y ctx7 library react "how to clean up useEffect with async operations"
#   → returns matches, each with a "Context7-compatible library ID", e.g. /reactjs/react.dev
#   add --json and parse: npx -y ctx7 library react "..." --json | jq -r '.[0].id'

# Step 2 — fetch docs for that ID + a specific natural-language question.
npx -y ctx7 docs /reactjs/react.dev "how to clean up useEffect with async operations"
#   add --json for structured output
```

**Valid subcommands are ONLY `library` and `docs`.** Other subcommands that exist:
`ctx7 login`, `ctx7 whoami`, `ctx7 setup`, `ctx7 upgrade` — but these are for
auth/setup only, not for doc lookups.

### Handling broad queries

For a broad query like **"svelte kit static site prerender seo"**:

1. First extract the library/framework name: `sveltekit` or `svelte`
2. Run Step 1 with the library: `npx -y ctx7 library sveltekit "static site prerender seo" --json`
3. Pick the best matching ID from results, then run Step 2

**Never try to stuff an entire query into `ctx7 search`** — there is no such
command. Always resolve the library first, then query the ID.

Notes:

- Library IDs **always start with `/`**. `ctx7 docs react "hooks"` fails — use the
  full `/org/project` ID from Step 1.
- Version-specific docs: use the version ID from Step 1, e.g.
  `ctx7 docs /vercel/next.js/v14.3.0-canary.87 "app router setup"`.
- Works **without auth**; `export CONTEXT7_API_KEY=<key>` (already set in this env via
  bob.env) just raises rate limits. Silence telemetry with `CTX7_TELEMETRY_DISABLED=1`.

## Method 2 — HTTP API (fallback, no install)

Works without a key (key → higher limits):

```bash
# Search for a library → take .results[0].id (e.g. "/reactjs/react.dev")
curl -sS "https://context7.com/api/v1/search?query=react" \
  -H "Authorization: Bearer ${CONTEXT7_API_KEY:-}" | jq -r '.results[0].id'

# Fetch docs by that ID (note the leading slash is part of the path)
curl -sS "https://context7.com/api/v1/reactjs/react.dev?type=txt&topic=useEffect%20cleanup" \
  -H "Authorization: Bearer ${CONTEXT7_API_KEY:-}"
```

## Best practices

- **Resolve once, reuse.** Keep the resolved `/org/project` ID in your reasoning;
  don't re-resolve within a session.
- **Ask specific questions.** "How to set up JWT auth in Express" beats "auth".
- **Trim the result.** Quote the relevant snippets into your answer rather than
  dumping the whole payload (cap with `-k`).

## context7 vs grep_app

| Tool                      | Best for                                          |
| ------------------------- | ------------------------------------------------- |
| **context7** (this skill) | Official docs, API references, framework guides   |
| **grep_app** (MCP)        | Real-world usage examples from public GitHub code |

Use them together: context7 to learn the API, grep_app to see how others use it.
