import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'av_chat_session';

function base64urlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToBase64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function hasValidSession(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) return false;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return false;
  if (!safeEqual(await sign(encoded, secret), sig)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(encoded))) as { user?: string; exp?: number };
    return Boolean(payload.user && typeof payload.exp === 'number' && payload.exp >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await hasValidSession(req);

  if (pathname === '/') {
    return NextResponse.redirect(new URL(session ? '/chat' : '/login', req.url));
  }

  if (pathname.startsWith('/chat') && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname.startsWith('/login') && session) {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/chat/:path*', '/login'],
};
