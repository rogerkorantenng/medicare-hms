'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, when } from '@/components/ui';
import type { AppNotification } from '@/lib/repository/types';

const ICON: Record<string, string> = {
  result: 'lab_profile', critical: 'e911_emergency', billing: 'payments',
};

export function AlertsList({ initial }: { initial: AppNotification[] }) {
  const [items, setItems] = useState(initial);
  const router = useRouter();
  const unread = items.filter((n) => !n.isRead).length;

  async function markAll() {
    setItems(items.map((n) => ({ ...n, isRead: true })));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="px-5 py-16 text-center">
        <span className="grid place-items-center w-14 h-14 mx-auto rounded-full bg-primary-tint text-primary">
          <Icon name="notifications" size={24} />
        </span>
        <p className="text-m-body font-display font-bold mt-3">Nothing yet</p>
        <p className="text-m-support text-ink-soft mt-1">
          We will let you know when a result is ready or a bill is settled.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 flex flex-col gap-2.5">
      {unread > 0 && (
        <button onClick={markAll} className="self-end text-m-support text-primary font-display font-bold min-h-[44px]">
          Mark all read
        </button>
      )}

      {items.map((n) => (
        <article
          key={n.id}
          className={`rounded-card border p-4 flex gap-3
            ${n.isRead ? 'bg-white border-hairline' : 'bg-primary-wash border-primary/25'}`}
        >
          <span
            className={`grid place-items-center w-10 h-10 rounded-full shrink-0
              ${n.kind === 'critical' ? 'bg-danger-bg text-danger-fg' : 'bg-primary-tint text-primary'}`}
          >
            <Icon name={ICON[n.kind] ?? 'notifications'} size={19} filled />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`font-display font-bold ${n.kind === 'critical' ? 'text-danger-fg' : ''}`}>
              {n.title}
            </p>
            {n.body && <p className="text-m-support text-ink-soft mt-0.5">{n.body}</p>}
            <p className="val text-m-chip text-ink-faint mt-1.5">{when(n.createdAt)}</p>
          </div>
          {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" aria-label="Unread" />}
        </article>
      ))}
    </div>
  );
}
