import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { getAgent } from '../../../../lib/agents';
import { messageText, OpenClawMessage, withOpenClaw } from '../../../../lib/openclaw';

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json();
    const agent = getAgent(typeof body.agentId === 'string' ? body.agentId : 'main');
    const sessionKey = typeof body.sessionKey === 'string' && body.sessionKey.trim() ? body.sessionKey.trim() : agent.defaultSessionKey;
    const result = await withOpenClaw<any>((client) =>
      client.request('chat.history', { sessionKey, limit: 200, maxChars: 300000 }),
    );
    const messages = Array.isArray(result?.messages)
      ? result.messages.map((message: OpenClawMessage, index: number) => ({
          id: String(message.id ?? `${index}-${message.timestamp ?? ''}`),
          role: typeof message.role === 'string' ? message.role : 'assistant',
          text: messageText(message),
          timestamp: message.timestamp ?? null,
        }))
      : [];
    return NextResponse.json({ sessionKey, sessionId: result?.sessionId ?? null, messages });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'History failed' }, { status: 500 });
  }
}
