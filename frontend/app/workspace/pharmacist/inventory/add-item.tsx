'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { addInventoryItemAction } from '@/app/actions';

const CATEGORIES = ['Analgesic', 'Antibiotic', 'Cardiovascular', 'Antidiabetic',
  'Respiratory', 'Consumable', 'Other'];

export function AddInventoryItem() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    const result = await addInventoryItemAction({
      name: String(form.get('name')).trim(),
      category: String(form.get('category')) || null,
      quantity: Number(form.get('quantity')) || 0,
      reorderLevel: Number(form.get('reorderLevel')) || 10,
      unitPrice: Number(form.get('unitPrice')) || 0,
      expiryDate: String(form.get('expiryDate')) || null,
    });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    toast(result.message);
    router.refresh();
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Icon name="add" size={18} />Add medicine
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 overflow-y-auto"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-lg p-6 my-8 animate-fadeUp">
            <h3 className="text-section">Add a medicine</h3>
            <p className="text-support text-ink-soft mt-1">
              The opening quantity is recorded as a movement, so the ledger
              reconciles from the first day.
            </p>

            <div className="grid sm:grid-cols-2 gap-3.5 mt-5">
              <div className="field sm:col-span-2">
                <label htmlFor="name">Name and strength</label>
                <input id="name" name="name" required minLength={2}
                       placeholder="Amoxicillin 500mg" />
              </div>
              <div className="field">
                <label htmlFor="category">Category</label>
                <select id="category" name="category" defaultValue="Other">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="quantity">Opening quantity</label>
                <input id="quantity" name="quantity" className="val" inputMode="numeric"
                       defaultValue={0} />
              </div>
              <div className="field">
                <label htmlFor="reorderLevel">Reorder level</label>
                <input id="reorderLevel" name="reorderLevel" className="val"
                       inputMode="numeric" defaultValue={10} />
              </div>
              <div className="field">
                <label htmlFor="unitPrice">Unit price (GHS)</label>
                <input id="unitPrice" name="unitPrice" className="val"
                       inputMode="decimal" defaultValue="0.00" />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="expiryDate">Expiry date</label>
                <input id="expiryDate" name="expiryDate" type="date" />
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
                <Icon name="add" size={18} />Add to inventory
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
