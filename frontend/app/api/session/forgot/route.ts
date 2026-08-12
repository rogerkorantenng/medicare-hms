import { NextResponse } from 'next/server';
import { apiBase } from '@/lib/api/client';

/**
 * Proxies the forgotten-password request.
 *
 * Unauthenticated, so it attaches no token; it exists only so the browser
 * never learns the API's address, which is the same reason every other
 * call the browser makes is relative to this application.
 */
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({ email: null }));
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Enter an email address.' }, { status: 400 });
  }

  const upstream = await fetch(`${apiBase()}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  });

  // The same answer either way, even if the API is unreachable: this form
  // must never become a way to find out which addresses are registered.
  const body = await upstream.json().catch(() => null);
  return NextResponse.json({
    message: body?.message
      ?? 'If that address is registered, reception can reset it for you.',
  });
}
