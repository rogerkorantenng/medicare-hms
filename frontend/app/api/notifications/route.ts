import { NextResponse } from 'next/server';
import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/supabase/server';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ notifications: [] }, { status: 401 });
  // The policy is "mine only" — either addressed to my MRN or to my staff id.
  return NextResponse.json({ notifications: await repo.notifications() });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id, all } = await req.json();
  if (all) {
    const list = await repo.notifications();
    await Promise.all(list.filter((n) => !n.isRead).map((n) => repo.markRead(n.id)));
  } else if (id) {
    await repo.markRead(Number(id));
  }
  return NextResponse.json({ ok: true });
}
