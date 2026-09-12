import { NextRequest, NextResponse } from 'next/server';

function redirectWithQuery(path: string, req: NextRequest) {
  const url = new URL(path, req.url);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Anyone already in Aneeverse (or opening this chat) should land in the
  // chat UI. Username/password is not asked.
  if (pathname === '/' || pathname.startsWith('/login')) {
    return redirectWithQuery('/chat', req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/chat/:path*', '/login'],
};
