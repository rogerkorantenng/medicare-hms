import { NextResponse } from 'next/server';
import { guard } from '../_guard';
import { complete, FALLBACK } from '@/lib/ai';
import { repo } from '@/lib/repository';

/**
 * 1. Consultation co-pilot — doctor only.
 *
 * Reads complaint, vitals, age, sex, conditions and allergies. Returns a
 * suggested diagnosis and plan into two editable fields. The doctor must
 * still supply a diagnosis to sign: this fills a field the doctor then owns,
 * it does not satisfy the requirement on its own.
 */
const SYSTEM = `You are a clinical documentation assistant inside a hospital management system.
Be concise, factual and plain-spoken. Never invent patient data beyond what is
given. Return EXACTLY two lines:
DX: <single most likely ICD-10 code and name>
PLAN: <2-3 sentence assessment and plan>`;

export async function POST(req: Request) {
  const g = await guard('doctor');
  if ('deny' in g) return g.deny;

  const { mrn, complaint } = await req.json();
  if (!mrn) return NextResponse.json({ error: 'mrn is required' }, { status: 400 });

  // Data minimisation: only what this task needs, never a bulk transfer.
  const chart = await repo.getPatientChart(mrn);
  const v = chart.vitals[0];

  const context = [
    `Age ${chart.patient.age}, ${chart.patient.sex === 'M' ? 'male' : 'female'}.`,
    chart.patient.conditions.length ? `Known conditions: ${chart.patient.conditions.join(', ')}.` : 'No known conditions.',
    chart.patient.allergies.length ? `Allergies: ${chart.patient.allergies.join(', ')}.` : 'No known allergies.',
    v ? `Vitals: BP ${v.systolic ?? '—'}/${v.diastolic ?? '—'} mmHg, pulse ${v.pulse ?? '—'} bpm, temperature ${v.temperature ?? '—'} °C, SpO2 ${v.spo2 ?? '—'}%.` : 'No vitals recorded this visit.',
    `Presenting complaint: ${complaint || 'not stated'}.`,
  ].join('\n');

  const text = await complete(SYSTEM, context, 400);
  if (!text) return NextResponse.json({ ok: false, message: FALLBACK.draftNote });

  // Split the two lines into the two fields they belong in.
  const dx = /^DX:\s*(.+)$/mi.exec(text)?.[1]?.trim() ?? '';
  const plan = /^PLAN:\s*([\s\S]+)$/mi.exec(text)?.[1]?.trim() ?? text.trim();

  return NextResponse.json({ ok: true, diagnosis: dx, plan });
}
