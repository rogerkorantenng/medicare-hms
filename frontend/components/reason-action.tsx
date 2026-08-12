'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';

/**
 * A button that asks why before it does anything.
 *
 * Cancelling an appointment, rejecting a sample, writing off a balance
 * and discontinuing a drug are all the same shape: an action somebody
 * will later need explained. Each one used to be missing entirely, and
 * building them separately would have produced four dialogs that drifted
 * apart. The reason is required, because the audit line is only worth
 * having if it says something.
 */
export function ReasonAction({
  label, icon, title, prompt, placeholder, confirmLabel = 'Confirm',
  tone = 'default', amount, perform,
}: {
  label: string;
  icon: string;
  title: string;
  prompt: string;
  placeholder: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  /** Set when the action needs a figure as well as a reason. */
  amount?: { label: string; hint?: string };
  perform: (reason: string, amount: number | null) => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const ready = reason.trim().length >= 3 && (!amount || Number(value) > 0);

  async function submit() {
    if (!ready) return;
    setBusy(true);
    const result = await perform(reason.trim(), amount ? Number(value) : null);
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); setReason(''); setValue(''); router.refresh(); }
  }

  return (
    <>
      <button
        className={`btn-ghost text-support ${tone === 'danger' ? '!text-danger-fg' : ''}`}
        onClick={() => setOpen(true)}
      >
        <Icon name={icon} size={16} />{label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-md p-6 animate-fadeUp"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-section">{title}</h3>
            <p className="text-support text-ink-soft mt-1">{prompt}</p>

            <div className="flex flex-col gap-3.5 mt-5">
              {amount && (
                <div className="field">
                  <label htmlFor="amount">{amount.label}</label>
                  <input id="amount" className="val" inputMode="decimal" value={value}
                         onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
                  {amount.hint && (
                    <p className="text-chip text-ink-soft">{amount.hint}</p>
                  )}
                </div>
              )}
              <div className="field">
                <label htmlFor="reason">Reason</label>
                <input id="reason" value={reason} placeholder={placeholder}
                       onChange={(e) => setReason(e.target.value)} />
                <p className="text-chip text-ink-soft">
                  Recorded against your name in the audit trail.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button
                className={tone === 'danger' ? 'btn bg-danger-fg text-white' : 'btn-primary'}
                onClick={submit} disabled={!ready || busy}
              >
                <Icon name={icon} size={18} />{confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
