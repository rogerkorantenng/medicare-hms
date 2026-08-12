'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import type { CatalogueItem } from '@/lib/repository/types';
import { addCatalogueItemAction, updateCatalogueItemAction } from '@/app/actions';

export function CatalogueRow({ item }: { item: CatalogueItem }) {
  const [price, setPrice] = useState(String(item.price));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save(patch: Parameters<typeof updateCatalogueItemAction>[1]) {
    setBusy(true);
    const result = await updateCatalogueItemAction(item.id, patch);
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setEditing(false); router.refresh(); }
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <input className="val w-24 text-right" inputMode="decimal" value={price}
               onChange={(e) => setPrice(e.target.value)} aria-label="New price" />
        <button className="btn-primary" disabled={busy}
                onClick={() => save({ price: Number(price) })}>Save</button>
        <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost text-support" onClick={() => setEditing(true)}>
        <Icon name="edit_note" size={16} />Reprice
      </button>
      <button className="btn-ghost text-support" disabled={busy}
              onClick={() => save({ isActive: !item.isActive })}>
        <Icon name={item.isActive ? 'block' : 'check_circle'} size={16} />
        {item.isActive ? 'Retire' : 'Restore'}
      </button>
    </div>
  );
}

export function AddCatalogueItem() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CatalogueItem['kind']>('lab');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    const result = await addCatalogueItemAction({
      kind,
      name: String(form.get('name')).trim(),
      bodyRegion: kind === 'imaging' ? String(form.get('bodyRegion')) || null : null,
      price: Number(form.get('price')) || 0,
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
        <Icon name="add" size={18} />Add entry
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-md p-6 animate-fadeUp">
            <h3 className="text-section">Add a catalogue entry</h3>

            <div className="flex flex-col gap-3.5 mt-5">
              <div className="field">
                <label htmlFor="kind">Kind</label>
                <select id="kind" value={kind}
                        onChange={(e) => setKind(e.target.value as CatalogueItem['kind'])}>
                  <option value="lab">Laboratory test</option>
                  <option value="imaging">Imaging study</option>
                  <option value="tariff">Tariff line</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" required minLength={2}
                       placeholder={kind === 'imaging' ? 'MRI' : 'Full Blood Count'} />
              </div>
              {kind === 'imaging' && (
                <div className="field">
                  <label htmlFor="bodyRegion">Body region</label>
                  <input id="bodyRegion" name="bodyRegion" placeholder="Knee" />
                </div>
              )}
              <div className="field">
                <label htmlFor="price">Price (GHS)</label>
                <input id="price" name="price" className="val" inputMode="decimal"
                       defaultValue="0.00" />
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-control border border-danger-br bg-danger-bg px-3 py-2 text-support text-danger-fg">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="add" size={18} />Add
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
