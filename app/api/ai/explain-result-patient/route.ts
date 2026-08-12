import { NextResponse } from 'next/server';
import { guard } from '../_guard';
import { complete, FALLBACK } from '@/lib/ai';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * 3. Result explainer, patient — the patient's own results only.
 *
 * The route verifies the result belongs to the caller and is verified.
 * Row-level security already enforces both, but the handoff asks for the
 * check to be explicit rather than relied upon, so a change to one does not
 * silently weaken the other.
 */
const SYSTEM = `You are a friendly health explainer in a patient app. Explain this test result in
2-3 warm, plain sentences with no jargon and no alarm. End with one practical tip.
Never diagnose. Suggest discussing it with their doctor where relevant. Under 70
words.`;

export async function POST(req: Request) {
  const g = await guard('patient');
  if ('deny' in g) return g.deny;

  const { labOrderId } = await req.json();
  if (!labOrderId) return NextResponse.json({ error: 'labOrderId is required' }, { status: 400 });

  const { data: order } = await supabaseServer()
    .from('lab_orders')
    .select('test_name, result_value, ref_range, flag, status, mrn')
    .eq('id', labOrderId)
    .maybeSingle();

  // Belt and braces. RLS returns nothing for another patient's row, and
  // nothing for an unverified one, so this should be unreachable.
  if (!order || order.status !== 'verified') {
    return NextResponse.json(
      { error: 'That result is not available to you.' },
      { status: 404 },
    );
  }

  const text = await complete(
    SYSTEM,
    `Test: ${order.test_name}\nResult: ${order.result_value}\nNormal range: ${order.ref_range ?? 'not stated'}`,
    250,
  );

  return text
    ? NextResponse.json({ ok: true, explanation: text.trim() })
    : NextResponse.json({ ok: false, message: FALLBACK.explainResultPatient });
}
