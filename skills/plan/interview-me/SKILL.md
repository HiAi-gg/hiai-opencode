---
name: interview-me
description: Explicit-opt-in skill for requirements discovery. Use ONLY when the human explicitly asks to be interviewed ("interview me", "ask me questions first", "clarify this with me"). Extracts true intent through one-question-at-a-time dialogue using the native question tool. Never auto-activates from underspecified requirements — HiAi planning is autonomous by default.
---

# Interview Me

## Overview

Users often know what they feel without knowing what they need. This skill extracts what users actually want vs. what they think they should want. It is used ONLY when the human explicitly requests an interview or requirements discovery.

**This skill is EXPLICIT-OPT-IN.** It must NOT activate merely because requirements are underspecified — HiAi OpenCode is autonomous by default, and technical/implementation ambiguity is resolved by research and best engineering judgment, not by interviewing the human. It must never be automatically invoked from an autonomous Bob/Manager execution loop.

**Core principle:** One meaningful question at a time, through the native `question` tool. Let the user think. Don't rush to solutions.

## When to Use

Use ONLY when the human explicitly asks, for example:

- "interview me"
- "ask me questions first"
- "clarify this with me"
- "help me define the requirements"
- equivalent explicit wording

**Don't use when:**
- Requirements are unclear but the user did not ask for an interview — research and resolve autonomously instead
- You are invoked as a subagent in an autonomous Bob/Manager loop — user questioning is forbidden
- Requirements are already clear and specific
- The user says "don't ask questions, just do X"

## The Interview Flow

### Step 1: Acknowledge and Set Expectations

Restate what you heard, confirm you'll ask a few questions, and note that the interview is optional and can stop at any time. Then start with your first `question` tool call.

### Step 2: Surface the Problem, Not the Solution

Ask about the problem, not the proposed solution.

Examples of the semantic content of a question (the actual user-facing question must be emitted through the native `question` tool):

- ❌ "You want me to add a dark mode toggle, right?" — leading, solution-shaped
- ✅ "What is the current experience that needs improving?" — problem-shaped

### Step 3: One Question Per Exchange

**One question. Wait for its structured answer. Then the next.**

Every actual user-facing interview question MUST be emitted through OpenCode's native `question` tool when available. Never print the interview question as ordinary assistant text.

For choice questions: provide concise option labels, useful descriptions, put the recommended option first, and preserve the native custom-answer path. Use `multiple: true` only when choices are genuinely non-exclusive.

### Step 4: Identify the Real Goal

The interview is done when you can fill this template:

```
"[User] needs to [action] so that [outcome].
Currently they [existing workaround or pain].
The constraint is [resources, time, technology]."
```

### Step 5: Return to Autonomous Planning

When intent is sufficiently clear, the interview is complete. Transition back into normal autonomous planning immediately. Do not remain in interview mode after the requested interview is complete, and do not ask follow-up questions for the sake of it.

## Notes

This interview skill does NOT override the Plan agent's native-question requirement: questions go through the `question` tool, never as plain text. It also does NOT override the autonomy contract — outside an explicitly requested interview, resolve ambiguity autonomously.

## Related Skills

- **`spec-driven-development`** — After interview, when user has a clear goal to formalize