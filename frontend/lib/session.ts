import { cache } from 'react';
import { cookies } from 'next/headers';
import { call, SESSION_COOKIE } from '@/lib/api/client';
import type { Role } from '@/lib/repository/types';

export type { Role };
export { SESSION_COOKIE };

/**
 * Who is asking.
 *
 * The token in the cookie is opaque to this application — it is not decoded
 * here and its claims are not trusted here. `GET /api/auth/me` verifies the
 * signature and re-reads the role from the database, so the answer below is
 * the API's answer, not a client-supplied one.
 *
 * Wrapped in React's `cache` so a page that renders a shell, a nav and a
 * table asks once per request rather than three times.
 */
export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  staffNo: string | null;
  department: string | null;
  mrn: string | null;
  /** True while they are still using a password somebody else typed. */
  mustChangePassword: boolean;
}

type ApiUser = {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  staff_no: string | null;
  department: string | null;
  mrn: string | null;
  must_change_password: boolean;
};

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  if (!cookies().get(SESSION_COOKIE)?.value) return null;
  try {
    const u = await call<ApiUser>('/auth/me');
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.full_name,
      staffNo: u.staff_no,
      department: u.department,
      mrn: u.mrn,
      mustChangePassword: Boolean(u.must_change_password),
    };
  } catch {
    // An expired or tampered token reads as signed out. The middleware
    // then sends the visitor to /login.
    return null;
  }
});

/** Throws unless the caller holds one of `roles`. Used by the AI routes. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Response('Not signed in', { status: 401 });
  if (!roles.includes(user.role)) throw new Response('Not permitted', { status: 403 });
  return user;
}

/** Where a role lands after signing in. */
export function homeFor(role: string): string {
  return role === 'patient' ? '/app' : `/workspace/${role}`;
}
