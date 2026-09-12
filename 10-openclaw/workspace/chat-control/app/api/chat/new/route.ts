import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { buildSessionKey, getAgent } from '../../../../lib/agents';

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json().catch(() => ({}));
    const agent = getAgent(typeof body.agentId === 'string' ? body.agentId : 'main');
    const sessionKey = buildSessionKey(agent.id, `web-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`);
    return NextResponse.json({ sessionKey });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
