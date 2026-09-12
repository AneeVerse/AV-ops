import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth';
import { AGENTS } from '../../../lib/agents';

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({ agents: AGENTS });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
