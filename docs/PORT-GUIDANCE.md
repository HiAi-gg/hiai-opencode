# Port Allocation Guidance

## Problem

Multiple projects default to port 5173 (Vite dev server), port 3000 (Next.js), or port 8080 (common web server), causing conflicts when run simultaneously. The `port-scanner.ts` completion-controller feature detects ports **post-hoc** from transcript logs, but cannot prevent conflicts at allocation time.

## Rule

- **Before assigning a dev port for a new project, check** `memory` or workspace for ports already in use.
- Use **unique high ports** in ranges:
  - **5000–5999** — Vite/dev servers, frontend hot-reload
  - **3000–3999** — Node/Bun backends, API servers
  - **7000–7999** — auxiliary services (databases, queues when not using defaults)
- **Do NOT default** to 5173, 3000, or 8080 without first checking for conflicts.

## Implementation

- `src/features/completion-controller/port-scanner.ts` tracks detected endpoints **post-hoc** from bash/read tool outputs. It is used by the completion-controller summary to show "what's now running" — it does **not** allocate ports.
- For **proactive allocation**, check running processes (`lsof -i :5173` or `ss -tlnp | grep <port>`) before starting a new dev server.
- In CI/automation, prefer environment-variable-driven port selection (e.g., `PORT=${PORT:-$(shuf -i 5000-5999 -n 1)}`) to avoid collisions.

## Existing Services Reference

| Service | Port |
|---------|------|
| ai-core PostgreSQL | 5433 |
| webs PostgreSQL | 5432 |
| ai-core Redis | 6380 |
| webs Redis | 6379 |
| hiai-bob backend | 50900 |
| hiai-bob frontend | 50901–50902 |

## See Also

- `src/features/completion-controller/port-scanner.ts` — post-hoc endpoint detection
- `docs/CONFIG.md` — full configuration reference
