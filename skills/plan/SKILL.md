---
name: planning-and-task-breakdown
description: Use when a spec or requirements exist and need to be broken into verifiable tasks with acceptance criteria. Explicit decomposition into tasks with clear definitions of done. Distinct from writing-plans which is output-focused.
---

# Planning and Task Breakdown

## Overview

Explicit task decomposition into verifiable units with acceptance criteria. This skill is distinct from `writing-plans` which is output-focused (produces a plan document). This skill focuses on decomposition process — turning a spec into a sequence of implementable, testable tasks.

**Core principle:** A task isn't done until it's verifiable. Every task needs a clear "done" criterion before it starts.

## When to Use

- A spec or requirements document exists
- Need to break work into manageable pieces
- Planning a multi-step implementation
- Before `subagent-driven-development` begins
- When "I have a plan" but the plan has no verifiable tasks

**Don't use when:**
- Requirements are still unclear → resolve autonomously first (research, repo conventions, documented assumptions); use `interview-me` ONLY if the human explicitly asks for an interview
- No spec exists → use `spec-driven-development` first
- Task is simple single-step → just do it, don't over-plan

## The Decomposition Process

### Step 1: Parse the Spec

Read the spec completely before breaking it down.

### Step 2: Identify Task Boundaries

**Rule: One task = one responsible party = one verification point**

### Step 3: Write Verifiable Tasks

Each task must answer:
- **What** is being built/modified
- **Where** it lives (file, module, component)
- **How to verify** it's done

### Step 4: Order by Dependency

Sequential, parallel, or conditional.

## Relationship to Other Skills

- **`interview-me`** — Used BEFORE this skill ONLY when the human explicitly requested an interview (otherwise resolve ambiguity autonomously)
- **`spec-driven-development`** — Used BEFORE this skill when no spec exists
- **`subagent-driven-development`** — Uses tasks from this skill for execution