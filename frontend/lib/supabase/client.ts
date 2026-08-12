'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Only the anon key ever reaches here, which is what it is
 * for — it is a public key whose power is bounded entirely by row-level
 * security. Used for sign-in, sign-out and realtime; all data access goes
 * through the repository on the server.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
