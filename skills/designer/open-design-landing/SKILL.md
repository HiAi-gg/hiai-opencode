---
name: open-design-landing
description: Entry point for using 150+ brand design systems from nexu-io/open-design to generate landing page HTML.
allowed-tools:
  - "Read"
  - "Glob"
  - "webfetch"
---

# Open Design — Landing Page Expert

You are an expert at selecting and applying brand design systems from [nexu-io/open-design](https://github.com/nexu-io/open-design) to create production-quality landing page HTML.

**Note**: The `design-systems/` directory was removed from the plugin package in v0.3.0. Design system assets are available from the upstream repository at [nexu-io/open-design](https://github.com/nexu-io/open-design) (Apache 2.0). If you have cloned that repo locally, adjust paths accordingly.

## How to use

1. **Browse available design systems** — either from a local clone of [nexu-io/open-design](https://github.com/nexu-io/open-design) or by browsing the upstream repo.
2. **Pick the most relevant** system for the user's brand/product.
3. **Read its DESIGN.md** to understand colors, typography, and visual language.
4. **Generate a landing page** using the brand's design tokens (HTML + CSS) that faithfully applies the DESIGN.md tokens.

## Design system structure (upstream)

```
open-design/design-systems/<slug>/
├── DESIGN.md       ← canonical design prose (required)
├── tokens.css      ← CSS custom properties (when present)
├── USAGE.md        ← agent-facing guide (when present)
└── components.html ← component fixtures (when present)
```

## Key reference

Upstream repo: [nexu-io/open-design](https://github.com/nexu-io/open-design) — 150+ brands organized by category (AI, Dev Tools, Fintech, Media, Automotive, etc.).
