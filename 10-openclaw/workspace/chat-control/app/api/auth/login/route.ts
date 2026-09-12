import { NextResponse } from 'next/server';
import { setSessionCookie, verifyLogin } from '../../../../lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (typeof username !== 'string' || typeof password !== 'string' || !verifyLogin(username, password)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }
    await setSessionCookie(username);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Login failed' }, { status: 500 });
  }
}
