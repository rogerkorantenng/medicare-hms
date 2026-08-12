import type { Prescription, SafetyResult } from './types';

/**
 * The prescription safety check.
 *
 * Deterministic, never AI. The handoff is explicit about why: "A safety block
 * must be reproducible." The same patient and the same drug must produce the
 * same answer every time, and it must be explainable to a pharmacist.
 *
 * There is deliberately no override. A blocked prescription cannot be forced
 * through from the screen — the submitted user manual states that a clinician
 * who judges the drug necessary despite the conflict handles it with the
 * pharmacist directly.
 */

/** Carried over from v1.0 unchanged. */
const ALLERGY_CLASSES: Record<string, string[]> = {
  Penicillin: ['Amoxicillin', 'Penicillin', 'Ampicillin', 'Flucloxacillin'],
  Sulfa: ['Sulfamethoxazole', 'Co-trimoxazole'],
  NSAID: ['Ibuprofen', 'Diclofenac', 'Naproxen'],
};

const NSAIDS = ['Ibuprofen', 'Diclofenac', 'Naproxen', 'Aspirin', 'Indometacin'];
const ANTICOAGULANTS = ['Warfarin', 'Apixaban', 'Rivaroxaban', 'Dabigatran', 'Heparin'];

/** Two RAAS agents together risk hyperkalaemia and hypotension. */
const RAAS_AGENTS = [
  'Lisinopril', 'Enalapril', 'Ramipril', 'Perindopril', 'Captopril',  // ACE inhibitors
  'Losartan', 'Valsartan', 'Candesartan', 'Irbesartan', 'Telmisartan', // ARBs
];

/**
 * "Amoxicillin 500mg" and "Amoxicillin" are the same ingredient. Strip the
 * strength and form so duplicate therapy is caught on the ingredient rather
 * than on an exact string match.
 */
export function activeIngredient(drug: string): string {
  return drug
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)\b/gi, '')
    .replace(/\b(tablet|tab|capsule|cap|inj|injection|inhaler|sachets?|syrup|cream|drops)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const isIn = (drug: string, list: string[]) => {
  const ingredient = activeIngredient(drug).toLowerCase();
  return list.some((d) => ingredient.includes(d.toLowerCase()));
};

/**
 * Evaluated in the order the contract specifies: allergy first, then
 * interactions, then duplicate therapy. Order matters — an allergy is the
 * more serious finding and should be the one reported.
 */
export function checkSafety(
  patientName: string,
  allergies: string[],
  activePrescriptions: Pick<Prescription, 'drug'>[],
  drug: string,
): SafetyResult {
  const proposed = activeIngredient(drug);

  // 1. Allergy — the drug belongs to a class the patient is allergic to.
  for (const allergen of allergies) {
    const members = ALLERGY_CLASSES[allergen];
    const hit = members
      ? isIn(drug, members)
      : proposed.toLowerCase().includes(allergen.toLowerCase());
    if (hit) {
      return {
        ok: false,
        kind: 'allergy',
        message: `ALLERGY ALERT — ${patientName} is allergic to ${allergen}. ${drug} is contraindicated.`,
      };
    }
  }

  const active = activePrescriptions.map((p) => p.drug);

  // 2. Warfarin, or any anticoagulant, with an NSAID.
  const addingNsaid = isIn(drug, NSAIDS);
  const addingAnticoag = isIn(drug, ANTICOAGULANTS);
  const onNsaid = active.some((d) => isIn(d, NSAIDS));
  const onAnticoag = active.some((d) => isIn(d, ANTICOAGULANTS));

  if ((addingNsaid && onAnticoag) || (addingAnticoag && onNsaid)) {
    return {
      ok: false,
      kind: 'interaction',
      message: 'INTERACTION — Major bleed risk. NSAID with anticoagulant.',
    };
  }

  // 3. Two RAAS agents, e.g. Lisinopril + Losartan.
  if (isIn(drug, RAAS_AGENTS) && active.some((d) => isIn(d, RAAS_AGENTS))) {
    return {
      ok: false,
      kind: 'interaction',
      message: 'INTERACTION — Two RAAS agents. Risk of hyperkalaemia and hypotension.',
    };
  }

  // 4. Same active ingredient already active.
  if (active.some((d) => activeIngredient(d).toLowerCase() === proposed.toLowerCase())) {
    return { ok: false, kind: 'interaction', message: 'INTERACTION — Duplicate therapy.' };
  }

  return { ok: true };
}

/**
 * The triage acuity suggestion. Also deterministic, also never AI, for the
 * same reason: a nurse must be able to see why it said what it said.
 * It suggests; the nurse sets the value.
 */
export function suggestAcuity(v: {
  systolic?: number | null; diastolic?: number | null;
  temperature?: number | null; pulse?: number | null; spo2?: number | null;
}): { acuity: 'routine' | 'semi_urgent' | 'urgent'; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (v.spo2 != null) {
    if (v.spo2 < 92) { score += 2; reasons.push(`SpO₂ ${v.spo2}% is below 92%`); }
    else if (v.spo2 < 95) { score += 1; reasons.push(`SpO₂ ${v.spo2}% is below 95%`); }
  }
  if (v.systolic != null) {
    if (v.systolic >= 180 || v.systolic < 90) { score += 2; reasons.push(`Systolic ${v.systolic} mmHg`); }
    else if (v.systolic >= 160) { score += 1; reasons.push(`Systolic ${v.systolic} mmHg`); }
  }
  if (v.diastolic != null && v.diastolic >= 110) {
    score += 1; reasons.push(`Diastolic ${v.diastolic} mmHg`);
  }
  if (v.pulse != null) {
    if (v.pulse > 130 || v.pulse < 45) { score += 2; reasons.push(`Pulse ${v.pulse} bpm`); }
    else if (v.pulse > 110) { score += 1; reasons.push(`Pulse ${v.pulse} bpm`); }
  }
  if (v.temperature != null) {
    if (v.temperature >= 39.5) { score += 2; reasons.push(`Temperature ${v.temperature} °C`); }
    else if (v.temperature >= 38) { score += 1; reasons.push(`Temperature ${v.temperature} °C`); }
  }

  const acuity = score >= 3 ? 'urgent' : score >= 1 ? 'semi_urgent' : 'routine';
  if (!reasons.length) reasons.push('All recorded observations are within normal limits');
  return { acuity, reasons };
}
