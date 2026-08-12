'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import type { InventoryItem } from '@/lib/repository/types';
import { moveStockAction } from '@/app/actions';

/**
 * Receiving a delivery, writing off breakage, and correcting a recount.
 *
 * Every movement demands a reason, because a quantity that changed for
 * no recorded cause is the thing that makes a stock take impossible to
 * reconcile later.
 */
export function StockMovement({ item }: { item: InventoryItem }) {
  const [open, setOpen] = useState<'receive' | 'adjust' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    const size = Math.abs(Number(amount));
    if (!size || !reason.trim()) return;
    setBusy(true);
    const result = await moveStockAction(
      item.id, open === 'receive' ? size : -size, reason.trim());
    setBusy(false);
    toast(result.ok ? result.message : result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(null); setAmount(''); setReason(''); router.refresh(); }
  }

  return (
    <>
      <div className="flex gap-1 justify-end">
        <button className="btn-ghost text-support" onClick={() => setOpen('receive')}>
          <Icon name="add" size={16} />Receive
        </button>
        <button className="btn-ghost text-support" onClick={() => setOpen('adjust')}>
          <Icon name="edit_note" size={16} />Adjust
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(null)}>
          <div className="panel w-full max-w-md p-6 animate-fadeUp"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-section">
              {open === 'receive' ? 'Receive stock' : 'Adjust count'}
            </h3>
            <p className="text-support text-ink-soft mt-1">
              {item.name} · <span className="val">{item.quantity}</span> in stock
            </p>

            <div className="flex flex-col gap-3.5 mt-5">
              <div className="field">
                <label htmlFor="qty">
                  {open === 'receive' ? 'Quantity received' : 'Quantity to remove'}
                </label>
                <input id="qty" className="val" inputMode="numeric" value={amount}
                       onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="field">
                <label htmlFor="why">Reason</label>
                <input id="why" value={reason} onChange={(e) => setReason(e.target.value)}
                       placeholder={open === 'receive'
                         ? 'Delivery note number' : 'Breakage, expiry or recount'} />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setOpen(null)}>Cancel</button>
              <button className="btn-primary" onClick={submit}
                      disabled={busy || !amount || reason.trim().length < 3}>
                <Icon name="save" size={18} />Record
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
