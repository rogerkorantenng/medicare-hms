import { NextResponse } from 'next/server';
import { guard } from '../_guard';
import { complete, FALLBACK } from '@/lib/ai';

/** 2. Result explainer, clinician — doctor, nurse, lab, radiology. */
const SYSTEM = `Explain this laboratory result to a clinician in 2-3 sentences, noting its
significance and the typical next step. Under 120 words.`;

export async function POST(req: Request) {
  const g = await guard('doctor', 'nurse', 'lab', 'radiology');
  if ('deny' in g) return g.deny;

  const { testName, resultValue, refRange, flag } = await req.json();

  const text = await complete(
    SYSTEM,
    `Test: ${testName}\nResult: ${resultValue}\nReference range: ${refRange ?? 'not stated'}\nFlag: ${flag ?? 'none'}`,
    300,
  );

  return text
    ? NextResponse.json({ ok: true, explanation: text.trim() })
    : NextResponse.json({ ok: false, message: FALLBACK.explainResult });
}
