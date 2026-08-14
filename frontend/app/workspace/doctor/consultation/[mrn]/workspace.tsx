'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signEncounterAction, checkSafetyAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon, Card, Chip, AiPanel, money } from '@/components/ui';
import type {
  PatientChart, Ward, StagedLab, StagedImaging, StagedRx, Priority, SafetyResult,
} from '@/lib/repository/types';

const LAB_CATALOGUE = [
  { name: 'Complete Blood Count', price: 35 }, { name: 'Lipid Panel', price: 45 },
  { name: 'Troponin I', price: 80 }, { name: 'Serum Potassium', price: 30 },
  { name: 'HbA1c', price: 60 }, { name: 'Liver Function Tests', price: 55 },
  { name: 'Malaria RDT', price: 20 }, { name: 'Urinalysis', price: 25 },
];
const MODALITIES = ['X-Ray', 'CT', 'MRI', 'Ultrasound'];
const REGIONS = ['Chest', 'Head', 'Abdomen', 'Pelvis', 'Spine', 'Limb'];
const SPECIALTIES = ['Cardiology', 'Neurology', 'Dermatology', 'Orthopaedics', 'General Medicine'];
const DRUGS = [
  'Lisinopril 10mg', 'Metformin 500mg', 'Amoxicillin 500mg', 'Paracetamol 500mg',
  'Ibuprofen 400mg', 'Salbutamol inhaler', 'Atorvastatin 20mg', 'Warfarin 5mg',
  'Losartan 50mg', 'Artemether-Lumefantrine', 'ORS sachets', 'Vitamin D3 1000IU',
];

export function ConsultationWorkspace({ chart, wards }: { chart: PatientChart; wards: Ward[] }) {
  const [complaint, setComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  const [labs, setLabs] = useState<StagedLab[]>([]);
  const [imaging, setImaging] = useState<StagedImaging[]>([]);
  const [rx, setRx] = useState<StagedRx[]>([]);
  const [admission, setAdmission] = useState<{ ward: string; bedNo: string } | null>(null);
  const [referral, setReferral] = useState<string>('');
  const [followUpDays, setFollowUpDays] = useState<string>('');
  const [safety, setSafety] = useState<SafetyResult | null>(null);

  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const v = chart.vitals[0];

  async function draftWithAi() {
    // A draft with nothing to go on would be a diagnosis invented from the
    // chart alone. The complaint is what the patient came in with, and it
    // is the one thing the model cannot infer.
    if (!complaint.trim()) {
      toast('Write the presenting complaint first. The draft works from it.', 'error');
      return;
    }
    setDrafting(true);
    setAiMessage(null);
    try {
      const res = await fetch('/api/ai/draft-note', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mrn: chart.patient.mrn, complaint }),
      });
      const json = await res.json();
      if (json.ok) {
        // Lands in editable fields. The doctor owns it from here.
        if (json.diagnosis) setDiagnosis(json.diagnosis);
        if (json.plan) setNotes((n) => (n ? `${n}\n\n${json.plan}` : json.plan));
        setAiAssisted(true);
      } else {
        setAiMessage(json.message ?? 'AI unavailable — write the note manually.');
      }
    } catch {
      setAiMessage('AI unavailable — write the note manually.');
    } finally {
      setDrafting(false);
    }
  }

  async function addPrescription(drug: string) {
    // Deterministic, and there is no override. A clinician who judges the drug
    // necessary despite the conflict handles it with the pharmacist directly.
    const result = await checkSafetyAction(chart.patient.mrn, drug);
    setSafety(result);
    if (!result.ok) return;
    setRx((list) => [...list, {
      drug, dose: '1 tablet', frequency: 'Once daily', duration: '7 days', quantity: 7,
    }]);
  }

  function sign() {
    if (!diagnosis.trim()) {
      toast('A diagnosis is required to sign a consultation.', 'error');
      return;
    }
    start(async () => {
      const r = await signEncounterAction({
        mrn: chart.patient.mrn,
        complaint: complaint.trim(),
        diagnosis: diagnosis.trim(),
        notes: notes.trim() || null,
        aiAssisted,
        labs, imaging, prescriptions: rx,
        admission,
        referral: referral ? { specialty: referral } : null,
        followUpDays: followUpDays ? Number(followUpDays) : null,
      });
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) router.push('/workspace/doctor');
    });
  }

  const stagedCount = labs.length + imaging.length + rx.length
    + (admission ? 1 : 0) + (referral ? 1 : 0) + (followUpDays ? 1 : 0);

  return (
    <div className="grid xl:grid-cols-[290px_minmax(0,1fr)_320px] lg:grid-cols-2 gap-5">
      {/* ---------- Left: what is already known ---------- */}
      <div className="flex flex-col gap-4">
        <Card title="Allergies">
          {chart.patient.allergies.length === 0 ? (
            <p className="text-support text-ink-soft">None recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {chart.patient.allergies.map((a) => <Chip key={a} tone="danger" icon="warning">{a}</Chip>)}
            </div>
          )}
        </Card>

        <Card title="Conditions">
          {chart.patient.conditions.length === 0 ? (
            <p className="text-support text-ink-soft">None recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {chart.patient.conditions.map((c) => <Chip key={c} tone="info">{c}</Chip>)}
            </div>
          )}
        </Card>

        <Card title="Latest vitals">
          {!v ? <p className="text-support text-ink-soft">No vitals this visit.</p> : (
            <dl className="grid grid-cols-2 gap-y-2.5 gap-x-3">
              {[
                ['Blood pressure', `${v.systolic ?? '—'}/${v.diastolic ?? '—'}`, 'mmHg'],
                ['Pulse', v.pulse ?? '—', 'bpm'],
                ['Temperature', v.temperature ?? '—', '°C'],
                ['SpO₂', v.spo2 ?? '—', '%'],
              ].map(([label, value, unit]) => (
                <div key={String(label)}>
                  <dt className="label">{label}</dt>
                  <dd className="val text-body font-bold">{value} <span className="text-ink-faint font-normal">{unit}</span></dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <Card title="Recent history">
          {chart.encounters.length === 0 ? (
            <p className="text-support text-ink-soft">No previous consultations.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {chart.encounters.slice(0, 4).map((e) => (
                <li key={e.id} className="border-l-2 border-primary-tint pl-3">
                  <p className="text-support font-display font-bold">{e.diagnosis}</p>
                  <p className="text-support text-ink-soft">{e.complaint}</p>
                  <p className="val text-chip text-ink-faint mt-0.5">
                    {new Date(e.createdAt).toLocaleDateString('en-GB')} · {e.doctorName ?? ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ---------- Centre: the note ---------- */}
      <div className="flex flex-col gap-4">
        <Card
          title="Consultation note"
          action={
            <button className="btn-secondary" onClick={draftWithAi}
                    disabled={drafting || !complaint.trim()}
                    title={complaint.trim() ? undefined : 'Write the presenting complaint first'}>
              <Icon name={drafting ? 'progress_activity' : 'auto_awesome'}
                    size={16} className={drafting ? 'animate-spin' : ''} filled={!drafting} />
              Draft with AI
            </button>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="field">
              <label htmlFor="complaint">Presenting complaint</label>
              <textarea id="complaint" rows={2} value={complaint}
                        onChange={(e) => setComplaint(e.target.value)}
                        placeholder="What the patient came in with." />
            </div>

            {aiMessage && (
              <p className="rounded-control border border-warning-br bg-warning-bg px-3 py-2 text-support text-warning-fg">
                {aiMessage}
              </p>
            )}

            {aiAssisted && (
              <AiPanel
                title="Drafted with AI"
                footnote="A suggestion, not a record. Edit both fields before signing — the diagnosis you sign is yours."
              >
                Both fields below were filled from the model and are yours to change.
              </AiPanel>
            )}

            <div className="field">
              <label htmlFor="diagnosis">
                Diagnosis <span className="text-danger-fg">required to sign</span>
              </label>
              <input id="diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                     placeholder="e.g. I10 Essential hypertension" />
            </div>

            <div className="field">
              <label htmlFor="notes">Assessment and plan</label>
              <textarea id="notes" rows={7} value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Assessment, plan, advice given." />
            </div>
          </div>
        </Card>
      </div>

      {/* ---------- Right: the staged order panel ---------- */}
      <div className="flex flex-col gap-4">
        <Card title={`Staged orders${stagedCount ? ` · ${stagedCount}` : ''}`}>
          <p className="text-support text-ink-soft mb-4">
            Nothing dispatches until you sign. Signing is one transaction — all of it
            commits or none of it does.
          </p>

          {safety && !safety.ok && (
            <div className="rounded-card border border-danger-br bg-danger-bg p-3 mb-4">
              <p className="flex items-start gap-2 text-support text-danger-fg font-display font-bold">
                <Icon name="block" size={17} className="mt-px" />
                {safety.message}
              </p>
              <p className="text-support text-danger-fg/80 mt-1.5">
                This block cannot be overridden here. If the drug is necessary, arrange
                it with the pharmacist directly.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Laboratory */}
            <section>
              <p className="label mb-1.5">Laboratory</p>
              <div className="flex gap-2">
                <select
                  className="flex-1"
                  defaultValue=""
                  onChange={(e) => {
                    const item = LAB_CATALOGUE.find((l) => l.name === e.target.value);
                    if (item) setLabs((l) => [...l, { testName: item.name, priority: 'routine', price: item.price }]);
                    e.currentTarget.value = '';
                  }}
                >
                  <option value="" disabled>Add a test…</option>
                  {LAB_CATALOGUE.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                </select>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {labs.map((l, i) => (
                  <li key={`${l.testName}-${i}`} className="flex items-center gap-2 rounded-control bg-surface-wash px-2.5 py-1.5">
                    <span className="text-support flex-1 truncate">{l.testName}</span>
                    <button
                      className={l.priority === 'stat' ? 'chip-danger' : 'chip-neutral'}
                      onClick={() => setLabs((list) => list.map((x, j) =>
                        j === i ? { ...x, priority: (x.priority === 'stat' ? 'routine' : 'stat') as Priority } : x))}
                    >
                      {l.priority === 'stat' ? 'STAT' : 'Routine'}
                    </button>
                    <button onClick={() => setLabs((list) => list.filter((_, j) => j !== i))}
                            aria-label={`Remove ${l.testName}`}>
                      <Icon name="close" size={15} className="text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Imaging */}
            <section>
              <p className="label mb-1.5">Imaging</p>
              <div className="flex gap-2">
                <select id="modality" className="flex-1" defaultValue="">
                  <option value="" disabled>Modality</option>
                  {MODALITIES.map((m) => <option key={m}>{m}</option>)}
                </select>
                <select id="region" className="flex-1" defaultValue="">
                  <option value="" disabled>Region</option>
                  {REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const m = (document.getElementById('modality') as HTMLSelectElement).value;
                    const r = (document.getElementById('region') as HTMLSelectElement).value;
                    if (m && r) setImaging((l) => [...l, { modality: m, bodyRegion: r, priority: 'routine', price: m === 'CT' ? 450 : m === 'MRI' ? 800 : 120 }]);
                  }}
                >
                  <Icon name="add" size={16} />
                </button>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {imaging.map((im, i) => (
                  <li key={`${im.modality}-${i}`} className="flex items-center gap-2 rounded-control bg-surface-wash px-2.5 py-1.5">
                    <span className="text-support flex-1 truncate">{im.modality} · {im.bodyRegion}</span>
                    <button onClick={() => setImaging((list) => list.filter((_, j) => j !== i))}
                            aria-label="Remove">
                      <Icon name="close" size={15} className="text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Prescriptions */}
            <section>
              <p className="label mb-1.5">Prescription</p>
              <select
                className="w-full"
                defaultValue=""
                onChange={(e) => { if (e.target.value) addPrescription(e.target.value); e.currentTarget.value = ''; }}
              >
                <option value="" disabled>Add a drug…</option>
                {DRUGS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <ul className="mt-2 flex flex-col gap-1.5">
                {rx.map((r, i) => (
                  <li key={`${r.drug}-${i}`} className="rounded-control bg-surface-wash px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-support font-semibold flex-1 truncate">{r.drug}</span>
                      <button onClick={() => setRx((list) => list.filter((_, j) => j !== i))} aria-label="Remove">
                        <Icon name="close" size={15} className="text-ink-faint" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                      <input className="text-support py-1" value={r.dose}
                             onChange={(e) => setRx((l) => l.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))} />
                      <input className="text-support py-1" value={r.frequency}
                             onChange={(e) => setRx((l) => l.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))} />
                      <input className="text-support py-1 val" type="number" min={1} value={r.quantity}
                             onChange={(e) => setRx((l) => l.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Admission, referral, follow-up */}
            <section className="grid gap-3">
              <div className="field">
                <label htmlFor="admit">Admit to a bed</label>
                <select
                  id="admit"
                  value={admission ? `${admission.ward}|${admission.bedNo}` : ''}
                  onChange={(e) => {
                    if (!e.target.value) return setAdmission(null);
                    const [ward, bedNo] = e.target.value.split('|');
                    setAdmission({ ward, bedNo });
                  }}
                >
                  <option value="">Not admitting</option>
                  {wards.flatMap((w) => w.beds.filter((b) => !b.mrn).map((b) => (
                    <option key={`${w.name}|${b.bedNo}`} value={`${w.name}|${b.bedNo}`}>
                      {w.name} · {b.bedNo}
                    </option>
                  )))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="refer">Refer to a specialty</label>
                <select id="refer" value={referral} onChange={(e) => setReferral(e.target.value)}>
                  <option value="">No referral</option>
                  {SPECIALTIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="field">
                <label htmlFor="follow">Follow-up in</label>
                <select id="follow" value={followUpDays} onChange={(e) => setFollowUpDays(e.target.value)}>
                  <option value="">No follow-up</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
            </section>
          </div>

          <div className="mt-5 pt-4 border-t border-hairline">
            <div className="flex items-center justify-between mb-3">
              <span className="label">Charges to capture</span>
              <span className="val font-bold">
                {money(120 + labs.reduce((s, l) => s + l.price, 0) + imaging.reduce((s, i) => s + i.price, 0))}
              </span>
            </div>
            <button className="btn-primary w-full py-2.5" onClick={sign} disabled={pending}>
              {pending ? <Icon name="progress_activity" className="animate-spin" size={18} /> : <Icon name="draw" size={18} />}
              Sign and complete
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
