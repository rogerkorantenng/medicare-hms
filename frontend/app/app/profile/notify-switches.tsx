'use client';

import { useState } from 'react';
import type { NotifyPrefs } from '@/lib/repository/types';
import { saveNotifyPrefsAction } from '@/app/actions';

const LABELS: [keyof NotifyPrefs, string, string][] = [
  ['results', 'Test results', 'When your care team releases a verified result'],
  ['appointments', 'Appointment reminders', 'The day before, and when a slot changes'],
  ['billing', 'Billing and payments', 'New invoices, and receipts after you pay'],
];

/**
 * These switches used to be painted on: hardcoded to on, with nowhere to
 * save an answer. They save now, and they save immediately, because a
 * settings screen with a Save button is a settings screen people leave
 * without pressing it.
 */
export function NotifySwitches({ initial }: { initial: NotifyPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState<keyof NotifyPrefs | null>(null);

  async function toggle(key: keyof NotifyPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);               // optimistic: the switch moves at once
    setBusy(key);
    const result = await saveNotifyPrefsAction(next);
    setBusy(null);
    if (!result.ok) setPrefs(prefs);   // put it back if the server refused
  }

  return (
    <div className="flex flex-col">
      {LABELS.map(([key, label, hint]) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={prefs[key]}
          aria-label={label}
          disabled={busy !== null}
          onClick={() => toggle(key)}
          className="flex items-center justify-between gap-4 min-h-[56px] text-left border-b border-hairline last:border-0 disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block text-m-body font-display font-semibold">{label}</span>
            <span className="block text-m-support text-ink-soft">{hint}</span>
          </span>
          <span
            className={`w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors
              ${prefs[key] ? 'bg-primary justify-end' : 'bg-ink-disabled justify-start'}`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-card" />
          </span>
        </button>
      ))}
    </div>
  );
}
