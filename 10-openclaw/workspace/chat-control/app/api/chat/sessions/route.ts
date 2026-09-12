import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { getAgent } from '../../../../lib/agents';
import { withOpenClaw } from '../../../../lib/openclaw';

export type ChatSessionSummary = {
  key: string;
  label: string;
  updatedAt: number | null;
  status: string | null;
  sessionId: string | null;
};

function labelForSession(key: string, updatedAt: number | null) {
  const parts = key.split(':');
  const mainKey = parts.slice(2).join(':') || 'main';
  if (mainKey === 'main') return 'Main chat';
  if (mainKey.startsWith('web-')) {
    const compact = mainKey.replace(/^web-/, '').replace(/-/g, ' ');
    return `Chat ${compact}`;
  }
  if (updatedAt) return `Chat ${new Date(updatedAt).toLocaleString('en-IN', { timeZone: 'UTC' })}`;
  return mainKey;
}

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json().catch(() => ({}));
    const agent = getAgent(typeof body.agentId === 'string' ? body.agentId : 'main');
    const result = await withOpenClaw<any>((client) => client.request('sessions.list', { limit: 200 }));
    const prefix = `agent:${agent.id}:`;
    const sessions: ChatSessionSummary[] = Array.isArray(result?.sessions)
      ? result.sessions
          .filter((session: any) => {
            const key = typeof session?.key === 'string' ? session.key : '';
            const provider = session?.origin?.provider;
            return key.startsWith(prefix) && provider === 'webchat';
          })
          .map((session: any) => {
            const updatedAt = typeof session.updatedAt === 'number' ? session.updatedAt : null;
            const key = session.key as string;
            return {
              key,
              label: typeof session.displayName === 'string' && session.displayName.trim()
                ? session.displayName.trim()
                : labelForSession(key, updatedAt),
              updatedAt,
              status: typeof session.status === 'string' ? session.status : null,
              sessionId: typeof session.sessionId === 'string' ? session.sessionId : null,
            };
          })
          .sort((a: ChatSessionSummary, b: ChatSessionSummary) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      : [];

    if (!sessions.some((session) => session.key === agent.defaultSessionKey)) {
      sessions.push({
        key: agent.defaultSessionKey,
        label: 'Main chat',
        updatedAt: null,
        status: null,
        sessionId: null,
      });
    }

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load sessions' }, { status: 500 });
  }
}
