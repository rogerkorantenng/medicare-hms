'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { addAddendumAction } from '@/app/actions';

/**
 * A signed consultation is not editable, and should not be. An addendum
 * is how a correction is made in a real record: the original stays, the
 * correction is dated and attributed, and a reader sees both.
 */
export function Addendum({ encounterId, mrn }: { encounterId: number; mrn: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setBusy(true);
    const result = await addAddendumAction(encounterId, mrn, String(form.get('body')));
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); router.refresh(); }
  }

  return (
    <>
      <button className="btn-ghost text-chip" onClick={() => setOpen(true)}>
        <Icon name="edit_note" size={14} />Add an addendum
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-lg p-6 animate-fadeUp">
            <h3 className="text-section">Add an addendum</h3>
            <p className="text-support text-ink-soft mt-1">
              The consultation itself does not change. Your addition is dated and
              recorded against your name beneath it, which is how a clinical
              record is corrected without rewriting what was originally written.
            </p>
            <div className="field mt-5">
              <label htmlFor="body">Addendum</label>
              <textarea id="body" name="body" rows={6} required minLength={5}
                        placeholder="Correction, or further information that came to light." />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="save" size={18} />Add it
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
