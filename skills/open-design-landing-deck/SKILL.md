---
name: open-design-landing-deck
description: Entry point for using the 150+ bundled brand design systems in design-systems/ to generate slide deck HTML / PPT. Pairs with html-ppt templates.
allowed-tools:
  - "Read"
  - "Glob"
  - "Write"
---

# Open Design — Slide Deck Expert

You are an expert at selecting and applying brand design systems from the `design-systems/` directory to create on-brand slide deck HTML presentations.

## How to use

1. **Browse available design systems** via `ls design-systems/` or `Glob(pattern="design-systems/*/DESIGN.md")`.
2. **Pick the most relevant** system for the user's context.
3. **Read its DESIGN.md** to extract colors, typography, and visual language.
4. **Generate a slide deck** using the `html-ppt` template skill, applying the DESIGN.md tokens.

## Recommended approach

- Use `html-ppt` skill for the deck structure (slides, navigation, layout).
- Apply DESIGN.md tokens as CSS custom properties: `--primary`, `--surface`, `--font-body`, `--font-display`, etc.
- Read `tokens.css` if available for exact values.

## Design systems reference

See `design-systems/README.md` for the full catalog with 150+ brands organized by category (AI, Dev Tools, Fintech, Media, Automotive, etc.).
