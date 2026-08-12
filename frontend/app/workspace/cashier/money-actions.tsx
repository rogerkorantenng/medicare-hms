'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { ReasonAction } from '@/components/reason-action';
import type { Invoice } from '@/lib/repository/types';
import {
  addInvoiceLineAction, raiseClaimAction, refundAction, writeOffAction,
} from '@/app/actions';

const INSURERS = ['NHIS', 'BlueShield HMO', 'Medicare', 'Aetna PPO'];

/**
 * Money used to move in one direction only. A payment could be taken and
 * nothing could be given back, so an overpayment or a mistyped figure
 * was permanent.
 *
 * A refund and a write-off are deliberately separate. A refund returns
 * money that arrived; a write-off closes a balance that never will. A
 * hospital counting revenue must not confuse the two.
 */
export function MoneyActions({ invoice }: { invoice: Invoice }) {
  const balance = Math.max(0, invoice.total - invoice.paid);

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <AddCharge invoice={invoice} />

      {invoice.paid > 0 && (
        <ReasonAction
          label="Refund" icon="payments"
          title="Refund part of this invoice"
          prompt={`${invoice.id}. Recorded as a negative payment, so the ledger still adds up.`}
          placeholder="Overcharged, or paid twice"
          confirmLabel="Record refund"
          amount={{ label: 'Amount to refund (GHS)',
                    hint: `Up to GHS ${invoice.paid.toFixed(2)} has been paid.` }}
          perform={(reason, amount) => refundAction(invoice.id, amount!, reason)}
        />
      )}

      {balance > 0 && (
        <>
          <ReasonAction
            label="Write off" icon="block" tone="danger"
            title="Write off the balance"
            prompt={`${invoice.id}. This closes the balance without any money arriving, so it is never counted as revenue.`}
            placeholder="Goodwill, or uncollectable"
            confirmLabel="Write it off"
            amount={{ label: 'Amount to write off (GHS)',
                      hint: `GHS ${balance.toFixed(2)} outstanding.` }}
            perform={(reason, amount) => writeOffAction(invoice.id, amount!, reason)}
          />
          <RaiseClaim invoice={invoice} balance={balance} />
        </>
      )}
    </div>
  );
}

function AddCharge({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setBusy(true);
    const result = await addInvoiceLineAction(
      invoice.id, String(form.get('description')).trim(), Number(form.get('amount')));
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); router.refresh(); }
  }

  return (
    <>
      <button className="btn-ghost text-support" onClick={() => setOpen(true)}>
        <Icon name="add" size={16} />Charge
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-md p-6 animate-fadeUp">
            <h3 className="text-section">Add a charge</h3>
            <p className="text-support text-ink-soft mt-1">
              For a dressing, a consumable or a bed-day: anything with no
              clinical event behind it to capture the charge automatically.
            </p>
            <div className="flex flex-col gap-3.5 mt-5">
              <div className="field">
                <label htmlFor="description">Description</label>
                <input id="description" name="description" required minLength={2}
                       placeholder="Wound dressing" />
              </div>
              <div className="field">
                <label htmlFor="amount">Amount (GHS)</label>
                <input id="amount" name="amount" className="val" inputMode="decimal"
                       required placeholder="0.00" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="add" size={18} />Add charge
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function RaiseClaim({ invoice, balance }: { invoice: Invoice; balance: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setBusy(true);
    const result = await raiseClaimAction(
      invoice.id, String(form.get('insurer')), Number(form.get('amount')));
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); router.refresh(); }
  }

  return (
    <>
      <button className="btn-ghost text-support" onClick={() => setOpen(true)}>
        <Icon name="health_metrics" size={16} />Claim
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-md p-6 animate-fadeUp">
            <h3 className="text-section">Raise an insurance claim</h3>
            <p className="text-support text-ink-soft mt-1">
              Against {invoice.id}. The claim number is allocated by the system,
              so two desks cannot collide on it.
            </p>
            <div className="flex flex-col gap-3.5 mt-5">
              <div className="field">
                <label htmlFor="insurer">Insurer</label>
                <select id="insurer" name="insurer" defaultValue="NHIS">
                  {INSURERS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="amount">Amount claimed (GHS)</label>
                <input id="amount" name="amount" className="val" inputMode="decimal"
                       defaultValue={balance.toFixed(2)} required />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="send" size={18} />Raise claim
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
