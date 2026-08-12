import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase/server';
import type { Role, SessionUser } from '@/lib/supabase/server';

/**
 * Every AI route checks the caller's role before responding. The handoff is
 * specific about why: "A cashier must not reach the consultation drafter."
 *
 * Returns either the caller or a response to send straight back.
 */
export async function guard(
  ...roles: Role[]
): Promise<{ user: SessionUser } | { deny: NextResponse }> {
  const user = await currentUser();
  if (!user) {
    return { deny: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  }
  if (!roles.includes(user.role)) {
    return {
      deny: NextResponse.json(
        { error: 'Your role does not have access to this feature.' },
        { status: 403 },
      ),
    };
  }
  return { user };
}
