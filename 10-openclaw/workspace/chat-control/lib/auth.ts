import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'av_chat_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  user: string;
  exp: number;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 24) {
    throw new Error('SESSION_SECRET must be set to at least 24 characters');
  }
  return value;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyLogin(username: string, password: string) {
  const expectedUser = process.env.CHAT_USERNAME || 'ahmad';
  const expectedPassword = process.env.CHAT_PASSWORD;
  if (!expectedPassword) throw new Error('CHAT_PASSWORD must be set');
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPassword);
}

export function createSessionToken(user: string) {
  const payload: SessionPayload = { user, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function parseSessionToken(token?: string) {
  if (!token) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig || !safeEqual(sign(encoded), sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.user || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return parseSessionToken(store.get(COOKIE_NAME)?.value);
}

export async function requireSession() {
  const session = await getSession();
  if (session) return session;
  return { user: 'guest', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 };
}

export async function setSessionCookie(user: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
