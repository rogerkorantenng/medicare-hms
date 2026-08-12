import { NextResponse } from 'next/server';
import { guard } from '../_guard';
import { complete, FALLBACK, type Turn } from '@/lib/ai';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * 6. Patient symptom checker — patient only, multi-turn.
 *
 * Sends the conversation history plus the patient's own age, sex and
 * conditions. Nothing about any other patient: row-level security means the
 * caller can only read their own row in the first place.
 */
export async function POST(req: Request) {
  const g = await guard('patient');
  if ('deny' in g) return g.deny;

  const { history } = (await req.json()) as { history: Turn[] };
  if (!Array.isArray(history) || !history.length) {
    return NextResponse.json({ error: 'history is required' }, { status: 400 });
  }

  const { data: me } = await supabaseServer()
    .from('patients')
    .select('age, sex, conditions, allergies')
    .eq('auth_user_id', g.user.id)
    .maybeSingle();

  const conditions = me?.conditions?.length ? me.conditions.join(', ') : 'nothing recorded';
  const allergies = me?.allergies?.length ? me.allergies.join(', ') : 'nothing recorded';

  const system = `You are a symptom checker in a hospital's patient app. Patient context: ${me?.age ?? 'unknown age'}, ${me?.sex === 'M' ? 'male' : me?.sex === 'F' ? 'female' : 'unspecified'}, history of ${conditions}, allergic to ${allergies}. Available specialties:
Cardiology, Neurology, Dermatology, Orthopaedics, General Medicine.

In under 80 words: acknowledge what they said, then either ask ONE clarifying
question or recommend a specialty with an urgency level of routine, within 24
hours, or emergency. For emergencies, tell them to call the emergency line
immediately. Never diagnose. Never prescribe. Never name a medication.`;

  // Keep the last few turns only — data minimisation, and it keeps the
  // model's attention on what was just said.
  const text = await complete(system, history.slice(-10), 300);
  if (!text) return NextResponse.json({ ok: false, message: FALLBACK.symptomCheck });

  // If a specialty has been named, the UI offers a "Book an appointment"
  // shortcut. Detected here so the client does not re-parse the reply.
  const specialties = ['Cardiology', 'Neurology', 'Dermatology', 'Orthopaedics', 'General Medicine'];
  const suggested = specialties.find((s) => new RegExp(s, 'i').test(text)) ?? null;
  const emergency = /\bemergency\b/i.test(text);

  return NextResponse.json({ ok: true, reply: text.trim(), suggestedSpecialty: suggested, emergency });
}
