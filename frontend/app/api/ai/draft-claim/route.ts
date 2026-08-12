import { NextResponse } from 'next/server';
import { guard } from '../_guard';
import { complete, FALLBACK } from '@/lib/ai';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * 4. Claims assistant — cashier and admin.
 *
 * The cashier reads and corrects the draft before sending. The submitted
 * user manual makes that instruction explicit, so the output lands in an
 * editable field and nothing is submitted automatically.
 */
const SYSTEM = `Draft a formal 2-3 sentence insurance claim justification. State the services
delivered and the clinical reason for them. Do not overstate. Under 100 words.`;

export async function POST(req: Request) {
  const g = await guard('cashier', 'admin');
  if ('deny' in g) return g.deny;

  const { claimId } = await req.json();
  if (!claimId) return NextResponse.json({ error: 'claimId is required' }, { status: 400 });

  const db = supabaseServer();
  const { data: claim } = await db
    .from('claims').select('insurer, amount, invoice_id').eq('id', claimId).maybeSingle();
  if (!claim) return NextResponse.json({ error: 'No such claim.' }, { status: 404 });

  // Only the billed lines — the clinical record is not sent.
  const { data: invoice } = await db
    .from('invoices').select('total, invoice_lines(description, amount)')
    .eq('id', claim.invoice_id).maybeSingle();

  const lines = (invoice?.invoice_lines ?? [])
    .map((l: { description: string; amount: number }) => `- ${l.description}: GHS ${Number(l.amount).toFixed(2)}`)
    .join('\n');

  const text = await complete(
    SYSTEM,
    `Insurer: ${claim.insurer}\nClaim amount: GHS ${Number(claim.amount).toFixed(2)}\nServices billed:\n${lines || '- not itemised'}`,
    300,
  );

  return text
    ? NextResponse.json({ ok: true, justification: text.trim() })
    : NextResponse.json({ ok: false, message: FALLBACK.draftClaim });
}
