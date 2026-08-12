'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Icon, when } from '@/components/ui';
import type { AuditEntry } from '@/lib/repository/types';

/** Reads the append-only audit trail, with a breathing live indicator. */
export function LiveActivity({ initial }: { initial: AuditEntry[] }) {
  const [items] = useState(initial);
  const router = useRouter();

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <Card
      title={
        <h2 className="text-card flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success-fg animate-breathe" aria-hidden="true" />
          Live activity
        </h2>
      }
    >
      <ul className="flex flex-col gap-3">
        {items.map((a) => (
          <li key={a.id} className="flex gap-3">
            <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-primary-tint text-primary">
              <Icon name="bolt" size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-support">
                <span className="font-display font-bold">{a.actorName}</span>{' '}
                <span className="text-ink-soft">{a.action.toLowerCase()}</span>
                {a.target && <span className="font-semibold"> {a.target}</span>}
              </p>
              <p className="val text-chip text-ink-faint mt-0.5">{when(a.occurredAt)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-support text-ink-soft mt-4 pt-3 border-t border-hairline">
        This trail is append-only. There is no edit or delete control anywhere,
        including for an administrator.
      </p>
    </Card>
  );
}
