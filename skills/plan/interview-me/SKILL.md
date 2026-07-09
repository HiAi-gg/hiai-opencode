---
name: interview-me
description: Use when requirements are underspecified or the user's stated goal differs from what they actually need. Extracts true intent through one-question-at-a-time dialogue. Critical for the Define phase when users have a vague idea but not a concrete spec.
---

# Interview Me

## Overview

Users often know what they feel without knowing what they need. This skill extracts what users actually want vs. what they think they should want. It is critical for the Define phase when requirements are underspecified or the user's stated goal differs from the real problem.

**Core principle:** One question at a time. Let the user think. Don't rush to solutions.

## When to Use

- User says "build something" without concrete details
- Requirements are vague, ambiguous, or contradictory
- The stated goal feels like a solution rather than a problem
- User says "just do X" when X seems unusual or risky
- You suspect the user wants Y but keeps asking about Z
- Early in Define phase before any planning or building

**Don't use when:**
- Requirements are already clear and specific
- User explicitly says "don't ask questions, just do X"
- This is a follow-up conversation with existing context

## The Interview Flow

### Step 1: Acknowledge and Set Expectations

```
"Understood — [restate what you heard]. Before I plan or build anything,
I need to understand the problem better. I'll ask a few questions.
If any feel off, tell me — that helps me understand the real issue."
```

### Step 2: Surface the Problem, Not the Solution

Ask about the problem, not the proposed solution.

```
❌ "You want me to add a dark mode toggle, right?"
✅ "What's the current experience that needs improving?"
```

### Step 3: One Question Per Exchange

**One question. Wait for answer. Then next.**

### Step 4: Identify the Real Goal

The conversation is done when you can fill this template:

```
"[User] needs to [action] so that [outcome].
Currently they [existing workaround or pain].
The constraint is [resources, time, technology]."
```

## Related Skills

- **`brainstorming`** — After interview, when user has a clear goal to explore
- **`spec-driven-development`** — After interview, when user has a clear goal to formalize