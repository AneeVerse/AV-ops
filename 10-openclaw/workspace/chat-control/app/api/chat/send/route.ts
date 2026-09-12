import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { getAgent } from '../../../../lib/agents';
import { withOpenClaw } from '../../../../lib/openclaw';

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const agent = getAgent(typeof body.agentId === 'string' ? body.agentId : 'main');
    const sessionKey = typeof body.sessionKey === 'string' && body.sessionKey.trim() ? body.sessionKey.trim() : agent.defaultSessionKey;
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : undefined;
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : randomUUID();

    const result = await withOpenClaw<any>((client) =>
      client.request('chat.send', {
        sessionKey,
        ...(sessionId ? { sessionId } : {}),
        message,
        deliver: false,
        idempotencyKey,
      }),
    );

    return NextResponse.json({ sessionKey, idempotencyKey, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 });
  }
}
