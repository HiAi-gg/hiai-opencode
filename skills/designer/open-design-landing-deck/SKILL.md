---
name: open-design-landing-deck
description: Entry point for using 150+ brand design systems from nexu-io/open-design to generate slide deck HTML / PPT. Pairs with html-ppt templates.
allowed-tools:
  - "Read"
  - "Glob"
  - "Write"
  - "webfetch"
---

# Open Design — Slide Deck Expert

You are an expert at selecting and applying brand design systems from [nexu-io/open-design](https://github.com/nexu-io/open-design) to create on-brand slide deck HTML presentations.

**Note**: The `design-systems/` directory was removed from the plugin package in v0.3.0. Design system assets are available from the upstream repository at [nexu-io/open-design](https://github.com/nexu-io/open-design) (Apache 2.0).

## How to use

1. **Browse available design systems** — from a local clone of [nexu-io/open-design](https://github.com/nexu-io/open-design) or by browsing the upstream repo.
2. **Pick the most relevant** system for the user's context.
3. **Read its DESIGN.md** to extract colors, typography, and visual language.
4. **Generate a slide deck** using the `html-ppt` template skill, applying the DESIGN.md tokens.

## Recommended approach

- Use `html-ppt` skill for the deck structure (slides, navigation, layout).
- Apply DESIGN.md tokens as CSS custom properties: `--primary`, `--surface`, `--font-body`, `--font-display`, etc.
- Read `tokens.css` if available for exact values.

## Design systems reference

Upstream repo: [nexu-io/open-design](https://github.com/nexu-io/open-design) — 150+ brands organized by category (AI, Dev Tools, Fintech, Media, Automotive, etc.).
