'use client';

import { useEffect, useState } from 'react';
import { Icon, when } from '@/components/ui';
import type { AppNotification } from '@/lib/repository/types';

/**
 * Notifications with an unread dot. A critical verified result arrives here
 * for the ordering doctor — the database writes it on the verify transition,
 * so it cannot appear before a technician has verified.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  async function load() {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      setItems(json.notifications ?? []);
    } catch { /* the bell is not worth an error state */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((n) => !n.isRead).length;
  const critical = items.some((n) => !n.isRead && n.kind === 'critical');

  async function markAll() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid place-items-center w-10 h-10 rounded-control hover:bg-surface-row transition"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Icon name="notifications" size={21} className="text-ink-soft" />
        {unread > 0 && (
          <span
            className={`absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 grid place-items-center
              rounded-full text-[10px] font-bold text-white
              ${critical ? 'bg-danger-fg animate-breathe' : 'bg-primary'}`}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[22rem] panel z-40 overflow-hidden animate-fadeUp">
            <header className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <p className="text-card">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="text-support text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </header>
            <ul className="max-h-96 overflow-y-auto divide-y divide-hairline">
              {items.length === 0 && (
                <li className="px-4 py-10 text-center text-support text-ink-soft">Nothing yet.</li>
              )}
              {items.map((n) => (
                <li key={n.id} className={`px-4 py-3 ${n.isRead ? '' : 'bg-primary-wash/50'}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon
                      name={n.kind === 'critical' ? 'e911_emergency' : n.kind === 'billing' ? 'payments' : 'lab_profile'}
                      size={18}
                      className={n.kind === 'critical' ? 'text-danger-fg' : 'text-primary'}
                      filled
                    />
                    <div className="min-w-0">
                      <p className={`text-support font-display font-bold ${n.kind === 'critical' ? 'text-danger-fg' : ''}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-support text-ink-soft mt-0.5">{n.body}</p>}
                      <p className="val text-chip text-ink-faint mt-1">{when(n.createdAt)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
