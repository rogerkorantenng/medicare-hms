'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon, Chip } from '@/components/ui';
import type { Patient } from '@/lib/repository/types';
import { updateClinicalFactsAction } from '@/app/actions';
import { TagField } from './tag-field';

/**
 * Allergies and chronic conditions.
 *
 * This is not bookkeeping. The prescribing guard reads the allergy list, so
 * a patient who mentions a reaction at triage is protected by nothing at
 * all until it is recorded here. That is why a nurse can reach it and not
 * only a doctor, and why the panel says so on screen.
 */
export function EditClinical({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  const [allergies, setAllergies] = useState<string[]>(patient.allergies);
  const [conditions, setConditions] = useState<string[]>(patient.conditions);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function add(list: string[], set: (v: string[]) => void, raw: string) {
    const value = raw.trim();
    if (value && !list.some((v) => v.toLowerCase() === value.toLowerCase())) {
      set([...list, value]);
    }
  }

  async function save() {
    setBusy(true);
    const result = await updateClinicalFactsAction(patient.mrn, { allergies, conditions });
    setBusy(false);
    toast(result.ok ? 'Clinical record updated.' : result.message,
          result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); router.refresh(); }
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="warning" size={16} />Allergies and conditions
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 overflow-y-auto"
             onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
               className="panel w-full max-w-lg p-6 my-8 animate-fadeUp">
            <h3 className="text-section">Allergies and conditions</h3>
            <p className="text-support text-ink-soft mt-1">
              {patient.fullName} · <span className="val">{patient.mrn}</span>
            </p>

            <p className="mt-4 flex items-start gap-2 rounded-control border border-warning-br bg-warning-bg px-3 py-2 text-support text-warning-fg">
              <Icon name="priority_high" size={16} className="mt-px" />
              An allergy recorded here blocks the drug at prescribing. One that
              is not recorded blocks nothing.
            </p>

            <TagField label="Allergies" tone="danger" values={allergies}
                      placeholder="Penicillin"
                      onAdd={(v) => add(allergies, setAllergies, v)}
                      onRemove={(v) => setAllergies(allergies.filter((a) => a !== v))} />

            <TagField label="Chronic conditions" tone="info" values={conditions}
                      placeholder="Hypertension"
                      onAdd={(v) => add(conditions, setConditions, v)}
                      onRemove={(v) => setConditions(conditions.filter((c) => c !== v))} />

            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>
                <Icon name="save" size={18} />Save record
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
