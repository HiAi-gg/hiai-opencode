import { type PluginInput, tool } from '@opencode-ai/plugin';

let sessionClient: PluginInput['client'] | null = null;

export function setSessionClient(client: PluginInput['client']) {
  sessionClient = client;
}

export const sessionListTool = tool({
  description: 'List all sessions in the current project.',
  args: {},
  async execute() {
    if (!sessionClient) return 'Session client not initialized.';
    try {
      const result = await sessionClient.session.list();
      const sessions = (result.data ?? []) as Array<{
        id: string;
        title?: string;
        status?: string;
      }>;
      return (
        sessions
          .map((s) => `${s.id}: ${s.title || 'untitled'} (${s.status || 'unknown'})`)
          .join('\n') || 'No sessions found.'
      );
    } catch (err) {
      return `Error listing sessions: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const sessionReadTool = tool({
  description: 'Read messages from a session.',
  args: {
    session_id: tool.schema.string().describe('Session ID to read'),
    limit: tool.schema.number().optional().describe('Max messages to return'),
  },
  async execute(input) {
    if (!sessionClient) return 'Session client not initialized.';
    try {
      const result = await sessionClient.session.messages({ path: { id: input.session_id } });
      const messages = (result.data ?? []) as Array<{
        info?: { role?: string };
        parts?: Array<{ type: string; text?: string }>;
      }>;
      const limit = input.limit ?? 20;
      return (
        messages
          .slice(-limit)
          .map((m) => {
            const role = m.info?.role ?? 'unknown';
            const text =
              m.parts
                ?.filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
                .join('') ?? '';
            return `[${role}]: ${text.slice(0, 500)}`;
          })
          .join('\n---\n') || 'No messages.'
      );
    } catch (err) {
      return `Error reading session: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const sessionSearchTool = tool({
  description: 'Search across all sessions.',
  args: {
    query: tool.schema.string().describe('Search query'),
  },
  async execute(input) {
    if (!sessionClient) return 'Session client not initialized.';
    try {
      const listResult = await sessionClient.session.list();
      const sessions = (listResult.data ?? []) as Array<{ id: string; title?: string }>;
      const results: string[] = [];
      for (const session of sessions.slice(0, 50)) {
        try {
          const msgs = await sessionClient.session.messages({ path: { id: session.id } });
          const text = (
            (msgs.data ?? []) as Array<{
              parts?: Array<{ type: string; text?: string }>;
            }>
          )
            .map((m) =>
              m.parts
                ?.filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
                .join(''),
            )
            .join(' ');
          if (text.toLowerCase().includes(input.query.toLowerCase())) {
            results.push(`${session.id}: ${session.title || 'untitled'}`);
          }
        } catch {}
      }
      return results.length ? results.join('\n') : `No results for "${input.query}"`;
    } catch (err) {
      return `Error searching sessions: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const sessionInfoTool = tool({
  description: 'Get metadata about a session.',
  args: {
    session_id: tool.schema.string().describe('Session ID'),
  },
  async execute(input) {
    if (!sessionClient) return 'Session client not initialized.';
    try {
      const result = await sessionClient.session.get({ path: { id: input.session_id } });
      const session = result.data as { id: string; title?: string; directory?: string } | undefined;
      if (!session) return 'Session not found.';
      return JSON.stringify(
        {
          id: session.id,
          title: session.title,
          directory: session.directory,
        },
        null,
        2,
      );
    } catch (err) {
      return `Error getting session info: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
