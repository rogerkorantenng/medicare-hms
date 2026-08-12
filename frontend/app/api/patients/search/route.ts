import { NextResponse } from 'next/server';
import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/supabase/server';

/** As-you-type patient search for the top bar and the command palette. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ patients: [] }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q') ?? '';
  // Row-level security decides what comes back. A patient searching would
  // only ever see themselves, which is why this needs no role check.
  const patients = await repo.searchPatients(q);
  return NextResponse.json({ patients: patients.slice(0, 8) });
}
