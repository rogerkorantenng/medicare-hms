import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps signed-out visitors out of the workspace and sends signed-in ones to
 * the right home for their role.
 *
 * This is navigation, not security. It reads the role claim without checking
 * the signature, which is deliberate — verifying here would mean an API call
 * on every asset request, and a forged claim gains nothing anyway: it moves
 * a visitor to a screen whose every query the API then refuses. The boundary
 * is app/security/deps.py, and it re-reads the role from the database.
 */
const SESSION_COOKIE = 'medicare_session';
const PUBLIC_PATHS = ['/login', '/welcome', '/forgot-password', '/api/session'];

/** The role claim, or null if the cookie is missing, malformed or expired. */
function readRole(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { role?: string; exp?: number };
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    return json.role ?? 'patient';
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const role = readRole(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!role && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    const redirect = NextResponse.redirect(url);
    // An expired token would otherwise redirect on every navigation.
    redirect.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return redirect;
  }

  if (role && (path === '/' || path === '/login')) {
    const url = request.nextUrl.clone();
    url.search = '';
    url.pathname = role === 'patient' ? '/app' : `/workspace/${role}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)'],
};
