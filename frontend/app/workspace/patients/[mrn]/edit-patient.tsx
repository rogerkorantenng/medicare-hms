'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import type { Patient } from '@/lib/repository/types';
import { correctPatientAction } from '@/app/actions';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const INSURERS = ['NHIS', 'BlueShield HMO', 'Medicare', 'Aetna PPO', 'Self-pay'];

/**
 * Correcting what reception captured.
 *
 * Deliberately not the MRN, the sex or the clinical facts: the MRN is the
 * business key every other record points at, and allergies belong to the
 * clinical panel next to this one, where a nurse or doctor can reach them.
 */
export function EditPatient({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    const result = await correctPatientAction(patient.mrn, {
      fullName: String(form.get('fullName')).trim(),
      age: Number(form.get('age')),
      phone: String(form.get('phone')).trim(),
      bloodGroup: String(form.get('bloodGroup')) || null,
      insurance: String(form.get('insurance')) || null,
    });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    toast('Details corrected.');
    router.refresh();
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="edit_note" size={16} />Correct details
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 overflow-y-auto"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-lg p-6 my-8 animate-fadeUp">
            <h3 className="text-section">Correct patient details</h3>
            <p className="text-support text-ink-soft mt-1">
              <span className="val">{patient.mrn}</span> · the medical record
              number never changes, because every other record points at it.
            </p>

            <div className="grid sm:grid-cols-2 gap-3.5 mt-5">
              <div className="field sm:col-span-2">
                <label htmlFor="fullName">Full name</label>
                <input id="fullName" name="fullName" required minLength={2}
                       defaultValue={patient.fullName} />
              </div>
              <div className="field">
                <label htmlFor="age">Age</label>
                <input id="age" name="age" className="val" inputMode="numeric"
                       required defaultValue={patient.age} />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" name="phone" required defaultValue={patient.phone} />
              </div>
              <div className="field">
                <label htmlFor="bloodGroup">Blood group</label>
                <select id="bloodGroup" name="bloodGroup"
                        defaultValue={patient.bloodGroup ?? ''}>
                  <option value="">Not recorded</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="insurance">Insurance</label>
                <select id="insurance" name="insurance"
                        defaultValue={patient.insurance ?? ''}>
                  <option value="">Not recorded</option>
                  {INSURERS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-control border border-danger-br bg-danger-bg px-3 py-2 text-support text-danger-fg">
                <Icon name="error" size={16} className="mt-px" />{error}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="save" size={18} />Save corrections
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
