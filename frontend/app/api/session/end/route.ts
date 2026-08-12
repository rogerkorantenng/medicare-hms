import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/api/client';

/**
 * Ends a session the server no longer recognises, and sends the visitor to
 * sign in.
 *
 * This exists to break a redirect loop with a specific cause. The
 * middleware reads the role claim without verifying it, which is what
 * keeps navigation cheap. So a token that is well-formed and unexpired
 * looks signed-in to the middleware even when the API refuses it, which
 * happens whenever an account is deactivated, deleted or reseeded while
 * somebody still holds a token for it. The layout would then redirect to
 * /login, the middleware would bounce that back to the workspace, and the
 * browser would give up with ERR_TOO_MANY_REDIRECTS.
 *
 * A server component cannot clear a cookie, so it redirects here instead:
 * one route handler that clears the cookie and lands on /login, where the
 * middleware now sees no session and leaves the visitor alone.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next');

  // A relative Location, deliberately. An absolute one has to be built
  // from a host, and neither request.url nor nextUrl knows the host the
  // browser used: inside a container both carry the container's own
  // hostname, and the redirect lands somewhere unreachable. RFC 7231
  // allows a relative Location and every browser resolves it against the
  // address it actually asked for, which is the one that is correct.
  const target = next && next !== '/'
    ? `/login?expired=1&next=${encodeURIComponent(next)}`
    : '/login?expired=1';

  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: target },
  });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
