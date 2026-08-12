'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { recordVitalsAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { suggestAcuity } from '@/lib/repository/safety';
import type { Acuity } from '@/lib/repository/types';

const num = (s: string) => (s.trim() === '' ? null : Number(s));

/**
 * Record vitals.
 *
 * The acuity suggestion panel sits DIRECTLY UNDER the inputs. That placement
 * is defect D-12: in v1.0 it sat above them, where the nurse had to scroll
 * back up to read it after typing.
 *
 * The suggestion is deterministic, not AI, so it can be explained — the
 * reasons are listed, not just the conclusion. The nurse sets the value; the
 * panel only proposes one.
 */
export function VitalsDialog({ mrn, name }: { mrn: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ systolic: '', diastolic: '', temperature: '', pulse: '', spo2: '', weightKg: '' });
  const [acuity, setAcuity] = useState<Acuity | ''>('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const suggestion = useMemo(
    () => suggestAcuity({
      systolic: num(f.systolic), diastolic: num(f.diastolic),
      temperature: num(f.temperature), pulse: num(f.pulse), spo2: num(f.spo2),
    }),
    [f],
  );

  const anyEntered = Object.values(f).some((v) => v.trim() !== '');
  const chosen = (acuity || suggestion.acuity) as Acuity;

  function set(k: keyof typeof f) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  }

  function save() {
    start(async () => {
      const r = await recordVitalsAction({
        mrn,
        systolic: num(f.systolic), diastolic: num(f.diastolic),
        temperature: num(f.temperature), pulse: num(f.pulse),
        spo2: num(f.spo2), weightKg: num(f.weightKg),
        acuity: chosen,
      });
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) { setOpen(false); router.refresh(); }
    });
  }

  // Written out in full rather than composed. Tailwind only sees literal
  // class names, so `bg-${tone}-bg` would be purged from the build.
  const TONE = {
    urgent: { box: 'bg-danger-bg border-danger-br', text: 'text-danger-fg', soft: 'text-danger-fg/90' },
    semi_urgent: { box: 'bg-warning-bg border-warning-br', text: 'text-warning-fg', soft: 'text-warning-fg/90' },
    routine: { box: 'bg-success-bg border-success-br', text: 'text-success-fg', soft: 'text-success-fg/90' },
  }[chosen];

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Icon name="monitor_heart" size={16} />Record vitals
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-lg p-6 my-8 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-section">Record vitals</h3>
            <p className="text-support text-ink-soft mt-1">{name} · <span className="val">{mrn}</span></p>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-3.5 mt-5">
              <div className="field">
                <label htmlFor="sys">Systolic (mmHg)</label>
                <input id="sys" className="val" inputMode="numeric" value={f.systolic} onChange={set('systolic')} placeholder="120" />
              </div>
              <div className="field">
                <label htmlFor="dia">Diastolic (mmHg)</label>
                <input id="dia" className="val" inputMode="numeric" value={f.diastolic} onChange={set('diastolic')} placeholder="80" />
              </div>
              <div className="field">
                <label htmlFor="temp">Temperature (°C)</label>
                <input id="temp" className="val" inputMode="decimal" value={f.temperature} onChange={set('temperature')} placeholder="36.8" />
              </div>
              <div className="field">
                <label htmlFor="pulse">Pulse (bpm)</label>
                <input id="pulse" className="val" inputMode="numeric" value={f.pulse} onChange={set('pulse')} placeholder="72" />
              </div>
              <div className="field">
                <label htmlFor="spo2">SpO₂ (%)</label>
                <input id="spo2" className="val" inputMode="numeric" value={f.spo2} onChange={set('spo2')} placeholder="98" />
              </div>
              <div className="field">
                <label htmlFor="wt">Weight (kg)</label>
                <input id="wt" className="val" inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} placeholder="70" />
              </div>
            </div>

            {/* Acuity suggestion — directly under the inputs. Defect D-12. */}
            <div className={`mt-4 rounded-card border p-4 ${TONE.box}`}>
              <p className={`flex items-center gap-1.5 font-display font-bold ${TONE.text}`}>
                <Icon name="rule" size={16} />
                Suggested acuity: {suggestion.acuity === 'semi_urgent' ? 'Semi-urgent'
                  : suggestion.acuity.charAt(0).toUpperCase() + suggestion.acuity.slice(1)}
              </p>
              <ul className={`mt-1.5 text-support list-disc pl-5 ${TONE.soft}`}>
                {suggestion.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <p className="text-support text-ink-soft mt-2">
                Calculated from the readings above, not generated. You set the value.
              </p>
            </div>

            <div className="field mt-4">
              <label htmlFor="acuity">Acuity</label>
              <select id="acuity" value={acuity || suggestion.acuity} onChange={(e) => setAcuity(e.target.value as Acuity)}>
                <option value="routine">Routine</option>
                <option value="semi_urgent">Semi-urgent</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <p className="text-support text-ink-soft mt-3">
              Implausible readings are rejected by the database, not just by this form.
            </p>

            <div className="flex gap-2 mt-5">
              <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={!anyEntered || pending} onClick={save}>
                {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="save" size={16} />}
                Save vitals
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
