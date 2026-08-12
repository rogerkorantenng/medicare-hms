import { NextResponse } from 'next/server';
import { apiBase, SESSION_COOKIE } from '@/lib/api/client';
import { homeFor } from '@/lib/session';

/**
 * Sign in and sign out.
 *
 * The browser posts credentials here rather than to the API directly, so the
 * token the API returns is written into an httpOnly cookie and never touches
 * client JavaScript. That is the whole reason this route exists: a token in
 * localStorage is readable by any script on the page, and a hospital record
 * is not something to hand to the first cross-site script that shows up.
 */

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const response = await fetch(`${apiBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      { error: body?.detail ?? 'That email and password do not match an account.' },
      { status: response.status === 401 ? 401 : 400 },
    );
  }

  const next = NextResponse.json({
    ok: true,
    role: body.user.role,
    home: homeFor(body.user.role),
  });

  next.cookies.set(SESSION_COOKIE, body.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: body.expires_in,
  });

  return next;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
