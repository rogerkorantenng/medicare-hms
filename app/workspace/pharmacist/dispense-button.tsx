'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dispenseAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';

/**
 * Calls the database function. Stock is decremented from current state
 * inside one transaction, never read-subtract-write from a copy the client
 * held — that was defect D-05.
 */
export function DispenseButton({ id, drug, quantity }: { id: number; drug: string; quantity: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <button
      className="btn-primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await dispenseAction(id);
          toast(r.ok ? `Dispensed ${quantity} × ${drug}.` : r.message, r.ok ? 'ok' : 'error');
          if (r.ok) router.refresh();
        })
      }
    >
      {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="check" size={16} />}
      Dispense
    </button>
  );
}
