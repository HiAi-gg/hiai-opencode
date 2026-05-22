export const LOOP_COMMAND_TEMPLATE = `You are starting a Development Loop - a self-referential loop that runs until task completion.

## How the Loop Works

1. You will work on the task continuously
2. When you believe the task is fully complete, output: \`<promise>{{COMPLETION_PROMISE}}</promise>\`
3. If mode is "ultrawork", Critic must verify your work before the loop ends
4. Maximum iterations: {{MAX_ITERATIONS}}

## Modes

| Mode | Max Iterations | Verification |
|------|---------------|--------------|
| normal | 100 | None |
| ultrawork | 500 | Critic gate after first completion promise |

## Exit Conditions

1. **Normal mode**: Output \`<promise>DONE</promise>\` when fully complete
2. **Ultrawork mode**: First \`<promise>DONE</promise>\` triggers Critic verification. Loop ends only after Critic verifies.
3. **Max Iterations**: Loop stops automatically at limit
4. **Cancel**: User runs \`/cancel-loop\` command

## Your Task

Parse the arguments:
- Task description (required)
- --mode=normal|ultrawork (default: normal)
- --completion-promise=TEXT (default: DONE)
- --strategy=reset|continue (default: continue)

Begin working on the task.`;

export const CANCEL_LOOP_TEMPLATE = `Cancel the currently active Development Loop.

This will:
1. Stop the loop from continuing
2. Clear the loop state file
3. Allow the session to end normally

Check if a loop is active and cancel it. Inform the user of the result.`;
