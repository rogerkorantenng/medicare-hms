import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Role } from '@/lib/repository/types';

export type { Role };

/**
 * The server-side Supabase client, built from the caller's session cookie.
 *
 * This matters more than it looks. Every repository query goes through this
 * client, so every query carries the signed-in user's JWT and row-level
 * security applies to it. The service-role key is never used here — it
 * bypasses RLS, and a screen that used it would silently undo migration
 * step 2. It appears in exactly one place in this repository,
 * scripts/create-users.mjs, which runs from a terminal and never on a request.
 */
export function supabaseServer() {
  const store = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session instead, so this is safe
            // to swallow — it is the pattern Supabase documents for the App
            // Router.
          }
        },
      },
    },
  );
}

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  staffNo: string | null;
  department: string | null;
  mrn: string | null;
}

/**
 * Who is asking. Reads the role from the JWT claim that the sync_role_claim
 * trigger keeps in step with the staff table, so no extra round trip is
 * needed on every request.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const claimRole = (user.app_metadata?.role as Role | undefined) ?? undefined;

  const { data: staff } = await supabase
    .from('staff')
    .select('staff_no, full_name, role, department')
    .eq('id', user.id)
    .maybeSingle();

  if (staff) {
    return {
      id: user.id,
      email: user.email ?? '',
      role: (staff.role ?? claimRole ?? 'patient') as Role,
      fullName: staff.full_name,
      staffNo: staff.staff_no,
      department: staff.department,
      mrn: null,
    };
  }

  // Not staff, so a patient. Their own row is the only one they can read.
  const { data: patient } = await supabase
    .from('patients')
    .select('mrn, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? '',
    role: (claimRole ?? 'patient') as Role,
    fullName: patient?.full_name ?? user.email ?? 'Patient',
    staffNo: null,
    department: null,
    mrn: patient?.mrn ?? null,
  };
}

/** Throws unless the caller holds one of `roles`. Used by the AI routes. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Response('Not signed in', { status: 401 });
  if (!roles.includes(user.role)) throw new Response('Not permitted', { status: 403 });
  return user;
}
