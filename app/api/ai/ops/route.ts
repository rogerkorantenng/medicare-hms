import { NextResponse } from 'next/server';
import { guard } from '../_guard';
import { complete, FALLBACK } from '@/lib/ai';
import { repo } from '@/lib/repository';

/**
 * 5. Operations copilot — admin only.
 *
 * The snapshot is assembled server-side and passed as system context. The
 * model answers from that snapshot only, so it cannot invent a number that
 * is not in front of it.
 */
export async function POST(req: Request) {
  const g = await guard('admin');
  if ('deny' in g) return g.deny;

  const { question } = await req.json();
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });

  const s = await repo.hospitalSnapshot();

  const snapshot = [
    `Patients registered: ${s.patientsTotal}`,
    `Bed occupancy by ward: ${s.wards.map((w) => `${w.name} ${w.occupied}/${w.total}`).join(', ')}`,
    `Queue waiting: ${s.queueWaiting}; in triage: ${s.queueInTriage}`,
    `Laboratory orders pending: ${s.labsPending}`,
    `Prescriptions pending: ${s.rxPending}`,
    `Revenue collected: GHS ${s.revenueCollected.toFixed(2)}; outstanding: GHS ${s.revenueOutstanding.toFixed(2)}`,
    `Staff on duty: ${s.staffOnDuty} of ${s.staffTotal}`,
    `Claims — submitted ${s.claims.submitted}, authorised ${s.claims.authorised}, paid ${s.claims.paid}`,
  ].join('\n');

  const system = `You are the operations copilot for MediCare+ General Hospital. Answer ONLY from
the data snapshot below, in 1-3 short sentences with concrete numbers. If the
snapshot does not contain the answer, say so. Never speculate.

Data: ${snapshot}`;

  const text = await complete(system, question, 300);

  return text
    ? NextResponse.json({ ok: true, answer: text.trim() })
    : NextResponse.json({ ok: false, message: FALLBACK.ops });
}
