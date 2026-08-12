'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { admitAction, dischargeAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon, onlyDate } from '@/components/ui';
import type { Bed, Patient } from '@/lib/repository/types';

export function BedTile({ bed }: { bed: Bed }) {
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

  function admit(mrn: string) {
    start(async () => {
      const r = await admitAction(mrn, bed.ward, bed.bedNo);
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) { setOpen(false); setQuery(''); setResults([]); router.refresh(); }
    });
  }

  function discharge() {
    start(async () => {
      const r = await dischargeAction(bed.ward, bed.bedNo);
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) { setOpen(false); router.refresh(); }
    });
  }

  const free = !bed.mrn;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`rounded-card border p-3 text-left transition hover:shadow-card
          ${free ? 'border-hairline bg-surface-wash' : 'border-info-br bg-info-bg'}`}
      >
        <div className="flex items-center justify-between">
          <span className="val font-bold">{bed.bedNo}</span>
          <Icon
            name={free ? 'bed' : 'person'}
            size={17}
            filled={!free}
            className={free ? 'text-ink-faint' : 'text-info-fg'}
          />
        </div>
        <p className={`text-support mt-1.5 truncate ${free ? 'text-ink-faint' : 'text-info-fg font-semibold'}`}>
          {free ? 'Free' : bed.patientName}
        </p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4" onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-md p-6 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-section">{bed.ward} · bed {bed.bedNo}</h3>

            {free ? (
              <>
                <p className="text-support text-ink-soft mt-1">This bed is free. Search for a patient to admit.</p>
                <div className="field mt-4">
                  <label htmlFor="q">Patient</label>
                  <input id="q" autoFocus value={query} onChange={(e) => search(e.target.value)}
                         placeholder="Name or MRN" />
                </div>
                <ul className="mt-2 max-h-56 overflow-y-auto flex flex-col gap-1">
                  {results.map((p) => (
                    <li key={p.mrn}>
                      <button
                        disabled={pending}
                        onClick={() => admit(p.mrn)}
                        className="w-full flex items-center justify-between rounded-control px-3 py-2 hover:bg-surface-row text-left"
                      >
                        <span>
                          <span className="block text-body font-semibold">{p.fullName}</span>
                          <span className="val block text-chip text-ink-soft">{p.mrn}</span>
                        </span>
                        <Icon name="add" size={16} className="text-primary" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="btn-ghost w-full mt-4" onClick={() => setOpen(false)}>Close</button>
              </>
            ) : (
              <>
                <p className="text-body mt-2 font-display font-bold">{bed.patientName}</p>
                <p className="val text-support text-ink-soft">{bed.mrn}</p>
                <p className="text-support text-ink-soft mt-2">
                  Admitted {onlyDate(bed.admittedAt)}
                </p>
                <p className="text-support text-ink-soft mt-4">
                  Discharging frees this bed and writes the discharge summary to the
                  patient&apos;s documents, in one transaction.
                </p>
                <div className="flex gap-2 mt-5">
                  <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>Cancel</button>
                  <button className="btn-primary flex-1" disabled={pending} onClick={discharge}>
                    {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="logout" size={16} />}
                    Discharge
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
