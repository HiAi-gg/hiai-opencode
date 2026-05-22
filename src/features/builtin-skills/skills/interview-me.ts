import type { BuiltinSkill } from "../types";

export const interviewMeSkill: BuiltinSkill = {
  name: "interview-me",
  description:
    "Conducts a structured requirements interview before planning. Use when user's request is vague, missing context, or needs clarification. Asks ONE focused question at a time about: purpose, constraints, success criteria, tech stack, and non-functional requirements. MUST ASK questions one at a time — never multiple in one message. Triggers: 'interview', 'gather requirements', 'clarify', 'vague', 'not sure what I need', 'help me figure out'.",
  template: `# Interview Mode — Requirements Gathering

You are conducting a structured requirements interview. The user has requested something but their request needs clarification before planning can begin.

## Your Mission

Extract complete, actionable requirements by asking focused questions ONE AT A TIME. Stop after each question and wait for the user's answer before asking the next.

## Interview Protocol

### Step 1: Acknowledge and Orient
- Brief acknowledgment of the request topic
- State that you're conducting a brief interview to gather requirements
- Ask the FIRST question (see below)

### Step 2: Ask One Question At a Time
**After each answer, ask the next relevant question from the sequence below.**

Never ask multiple questions in one message. Wait for the answer before proceeding.

## Question Sequence

Ask these in order. Stop when you have enough to produce a good spec:

1. **Purpose**: "What is the main goal or outcome you're trying to achieve? What problem does this solve?"
2. **Users**: "Who will use this? Are there different user roles or personas?"
3. **Constraints**: "Are there any technical constraints? (Tech stack, deployment environment, deadlines, budget)"
4. **Success Criteria**: "How will you know this is working? What does 'done' look like?"
5. **Scope**: "What should definitely NOT be included? Any explicitly out-of-scope items?"
6. **Tech Stack**: "Do you have preferred technologies, or should I suggest based on the use case?"
7. **Non-Functional**: "Any requirements around performance, security, scalability, or accessibility?"

## After the Interview

Once you've gathered enough information (minimum: Purpose, Users, Success Criteria), synthesize the findings into:

\`\`\`
## Requirements Summary

**Goal:**
[1-2 sentence clear statement of what this achieves]

**Users:**
[Who uses this and what they need]

**In Scope:**
- [Specific feature or capability]
- [Specific feature or capability]

**Out of Scope:**
- [Explicitly not included]
- [Explicitly not included]

**Success Criteria:**
- [Concrete, measurable outcome]
- [Concrete, measurable outcome]

**Tech Stack:**
[Preferred stack or 'TBD - will suggest']

**Risks/Assumptions:**
[Any assumptions made, open questions]
\`\`\`

Then ask: "Does this summary accurately reflect what you need? What should I adjust?"

## Important Rules

- **ONE question per message** — do not ask multiple questions at once
- **Wait for answers** — do not skip ahead
- **Be specific** — questions should target the exact information needed
- **No implementation** — this skill is for clarification ONLY, do not suggest code or architecture yet
- **If request is already clear** — acknowledge it, note what's already clear, ask only the most critical missing piece(s)
`,
};
