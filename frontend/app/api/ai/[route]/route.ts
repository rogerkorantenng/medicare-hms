import { NextResponse } from 'next/server';
import { apiBase, SESSION_COOKIE } from '@/lib/api/client';
import { cookies } from 'next/headers';

/**
 * The six AI features, proxied to the API.
 *
 * There is no model call, no prompt and no role check in this file, and that
 * is the point. All three live in the FastAPI service — the prompts in
 * app/prompts.py, the role guards on the routes themselves — so an examiner
 * checking the prompts against the submitted design reads one file instead
 * of six, and a cashier cannot reach the consultation drafter by calling
 * this proxy directly.
 *
 * The route exists at all because the browser must not hold the token: it is
 * attached here, from an httpOnly cookie.
 */
const ROUTES = new Set([
  'draft-note',
  'explain-result',
  'explain-result-patient',
  'draft-claim',
  'ops',
  'symptom-check',
]);

export async function POST(
  request: Request,
  { params }: { params: { route: string } },
) {
  if (!ROUTES.has(params.route)) {
    return NextResponse.json({ error: 'No such feature.' }, { status: 404 });
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const upstream = await fetch(`${apiBase()}/api/ai/${params.route}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: await request.text(),
    cache: 'no-store',
  });

  const body = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: body?.detail ?? 'That did not work.' },
      { status: upstream.status },
    );
  }

  return NextResponse.json(body);
}
