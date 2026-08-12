'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { checkInAction, walkInAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import type { Patient } from '@/lib/repository/types';

export function CheckInButton({ id, name }: { id: number; name: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <button
      className="btn-primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await checkInAction(id);
          toast(r.ok ? `${name} checked in.` : r.message, r.ok ? 'ok' : 'error');
          if (r.ok) router.refresh();
        })
      }
    >
      {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="how_to_reg" size={16} />}
      Check in
    </button>
  );
}

export function WalkInDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
      setResults((await res.json()).patients ?? []);
    } catch { setResults([]); }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Icon name="person_add" size={17} />Add walk-in
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4" onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-md p-6 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-section">Add a walk-in</h3>
            <p className="text-support text-ink-soft mt-1">
              The patient is placed with the first on-duty doctor who has a free slot today.
            </p>

            <div className="field mt-4">
              <label htmlFor="walkq">Find the patient</label>
              <input id="walkq" autoFocus value={query} onChange={(e) => search(e.target.value)}
                     placeholder="Name, MRN or phone" />
            </div>

            <ul className="mt-2 max-h-64 overflow-y-auto flex flex-col gap-1">
              {results.map((p) => (
                <li key={p.mrn}>
                  <button
                    disabled={pending}
                    className="w-full flex items-center justify-between rounded-control px-3 py-2 hover:bg-surface-row text-left"
                    onClick={() =>
                      start(async () => {
                        const r = await walkInAction(p.mrn);
                        toast(r.ok ? `${p.fullName} added to the queue.` : r.message, r.ok ? 'ok' : 'error');
                        if (r.ok) { setOpen(false); setQuery(''); setResults([]); router.refresh(); }
                      })
                    }
                  >
                    <span>
                      <span className="block text-body font-semibold">{p.fullName}</span>
                      <span className="val block text-chip text-ink-soft">{p.mrn} · {p.phone}</span>
                    </span>
                    <Icon name="add" size={17} className="text-primary" />
                  </button>
                </li>
              ))}
              {query.length >= 2 && results.length === 0 && (
                <li className="px-3 py-6 text-center text-support text-ink-soft">
                  No patient matches. Register them first.
                </li>
              )}
            </ul>

            <button className="btn-ghost w-full mt-4" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
