/**
 * Shared Background Task Protocol for HiaiOpenCode.
 * Guides agents on how to run background tasks and retrieve results.
 */

export const BACKGROUND_TASK_PROTOCOL = `
<BACKGROUND_TASK_PROTOCOL>
## Retrieving Background Subagent Results

When you spawn subagents or background tasks using \`task(..., run_in_background=true)\` or similar tools:
1. You MUST NOT poll or block waiting for them. Instead, end your response to allow the system to execute the task.
2. Once the subagents/tasks finish, you will receive a \`<system-reminder>\` message in your chat history notifying you of completion.
3. **CRITICAL**: The completion notification ONLY lists the completed task IDs. It does NOT contain the actual subagent outputs.
4. **MANDATORY ACTION**: You MUST explicitly call the \`background_output(task_id="<id>")\` tool to fetch the actual output/result of each completed subagent. Never guess, assume, or proceed without calling \`background_output\` on completed tasks.
5. If the \`background_output\` tool indicates the subagent failed, you must follow your failure recovery instructions or notify the user.
</BACKGROUND_TASK_PROTOCOL>
`;
