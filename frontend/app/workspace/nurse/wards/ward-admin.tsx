'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { ReasonAction } from '@/components/reason-action';
import type { Bed } from '@/lib/repository/types';
import {
  addBedAction, addWardAction, setBedAvailabilityAction, transferBedAction,
} from '@/app/actions';

/**
 * Opening a ward, adding a bed, and taking one out of service.
 *
 * The 34 beds came from the seed and nothing could change them. A ward
 * that cannot take a bed offline for cleaning or repair overstates its
 * capacity, which is the one number the bed board exists to report.
 */
export function WardAdmin({ wards }: { wards: string[] }) {
  const [open, setOpen] = useState<'ward' | 'bed' | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setBusy(true);
    const result = open === 'ward'
      ? await addWardAction(String(form.get('name')).trim())
      : await addBedAction(String(form.get('ward')), String(form.get('bedNo')).trim());
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(null); router.refresh(); }
  }

  return (
    <div className="flex gap-2">
      <button className="btn-secondary" onClick={() => setOpen('bed')}>
        <Icon name="add" size={16} />Add a bed
      </button>
      <button className="btn-secondary" onClick={() => setOpen('ward')}>
        <Icon name="home" size={16} />Open a ward
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(null)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-md p-6 animate-fadeUp">
            <h3 className="text-section">
              {open === 'ward' ? 'Open a ward' : 'Add a bed'}
            </h3>
            <div className="flex flex-col gap-3.5 mt-5">
              {open === 'ward' ? (
                <div className="field">
                  <label htmlFor="name">Ward name</label>
                  <input id="name" name="name" required minLength={2}
                         placeholder="Isolation Unit" />
                </div>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="ward">Ward</label>
                    <select id="ward" name="ward">
                      {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="bedNo">Bed number</label>
                    <input id="bedNo" name="bedNo" required placeholder="A7" />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="save" size={18} />Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/** Taking a bed out of service, or moving a patient between beds. */
export function BedActions({ bed, wards }: { bed: Bed; wards: string[] }) {
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function move(form: FormData) {
    setBusy(true);
    const result = await transferBedAction(
      bed.mrn!, String(form.get('ward')), String(form.get('bedNo')).trim());
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setMoving(false); router.refresh(); }
  }

  if (bed.mrn) {
    return (
      <>
        <button className="btn-ghost text-chip" onClick={() => setMoving(true)}>
          <Icon name="arrow_forward" size={14} />Move
        </button>
        {moving && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
               onClick={() => setMoving(false)}>
            <form action={move} onClick={(e) => e.stopPropagation()}
                  className="panel w-full max-w-md p-6 animate-fadeUp">
              <h3 className="text-section">Move {bed.patientName}</h3>
              <p className="text-support text-ink-soft mt-1">
                From {bed.ward} {bed.bedNo}. Freeing the old bed and taking the
                new one happen together, so the patient is never in neither.
              </p>
              <div className="grid grid-cols-2 gap-3.5 mt-5">
                <div className="field">
                  <label htmlFor="ward">Ward</label>
                  <select id="ward" name="ward" defaultValue={bed.ward}>
                    {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="bedNo">Bed</label>
                  <input id="bedNo" name="bedNo" required placeholder="B2" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" className="btn-ghost" onClick={() => setMoving(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy}>
                  <Icon name="arrow_forward" size={18} />Move
                </button>
              </div>
            </form>
          </div>
        )}
      </>
    );
  }

  return (
    <ReasonAction
      label="Offline" icon="block"
      title={`Take ${bed.ward} ${bed.bedNo} out of service`}
      prompt="It stops counting towards capacity until it is put back."
      placeholder="Deep clean, or awaiting repair"
      confirmLabel="Take it offline"
      perform={(reason) => setBedAvailabilityAction(bed.ward, bed.bedNo, false, reason)}
    />
  );
}
