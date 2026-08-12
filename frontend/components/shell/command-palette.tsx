'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { Icon, Avatar } from '@/components/ui';
import type { Patient, Role } from '@/lib/repository/types';

/** Ctrl+K or ⌘K. Searches patients and screens. Escape closes. */
export function CommandPalette({
  open, onClose, role,
}: { open: boolean; onClose: () => void; role: Role }) {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const screens = useMemo(
    () => (NAV[role] ?? []).filter((s) => s.label.toLowerCase().includes(query.toLowerCase())),
    [role, query],
  );

  useEffect(() => {
    if (open) { setQuery(''); setPatients([]); setCursor(0); inputRef.current?.focus(); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setPatients([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setPatients(json.patients ?? []);
      } catch {
        setPatients([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open]);

  const results = useMemo(
    () => [
      ...screens.map((s) => ({ kind: 'screen' as const, href: s.href, label: s.label, icon: s.icon })),
      ...patients.map((p) => ({ kind: 'patient' as const, href: `/workspace/patients/${p.mrn}`, label: p.fullName, mrn: p.mrn })),
    ],
    [screens, patients],
  );

  if (!open) return null;

  function go(href: string) { onClose(); router.push(href); }

  return (
    <div
      className="fixed inset-0 z-50 bg-sidebar/50 p-4 pt-[12vh] no-print"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="panel max-w-xl mx-auto overflow-hidden animate-fadeUp shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-hairline">
          <Icon name="search" size={20} className="text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === 'Enter' && results[cursor]) go(results[cursor].href);
            }}
            placeholder="Search patients by name or MRN, or jump to a screen"
            className="flex-1 bg-transparent border-0 py-4 text-body focus:ring-0 px-0"
          />
          <kbd className="val text-chip text-ink-faint border border-hairline rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-support text-ink-soft">
              {query.length < 2 ? 'Type at least two characters.' : 'Nothing matches that.'}
            </li>
          )}
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.href}`}>
              <button
                onClick={() => go(r.href)}
                onMouseEnter={() => setCursor(i)}
                className={`w-full flex items-center gap-3 rounded-control px-3 py-2.5 text-left transition
                  ${i === cursor ? 'bg-primary-tint' : 'hover:bg-surface-row'}`}
              >
                {r.kind === 'screen' ? (
                  <span className="grid place-items-center w-8 h-8 rounded-control bg-primary-tint text-primary shrink-0">
                    <Icon name={r.icon} size={18} />
                  </span>
                ) : (
                  <Avatar name={r.label} size={32} />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-body font-display font-semibold truncate">{r.label}</span>
                  <span className="block text-chip text-ink-soft">
                    {r.kind === 'screen' ? 'Screen' : <span className="val">{r.mrn}</span>}
                  </span>
                </span>
                <Icon name="arrow_forward" size={16} className="text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
