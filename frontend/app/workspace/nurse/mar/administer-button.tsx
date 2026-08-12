'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { administerAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';

export function AdministerButton({ id, drug, due }: { id: number; drug: string; due: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <button
      className={due ? 'btn-primary' : 'btn-ghost'}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await administerAction(id);
          toast(r.ok ? `Recorded — ${drug}.` : r.message, r.ok ? 'ok' : 'error');
          if (r.ok) router.refresh();
        })
      }
    >
      {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="check" size={16} />}
      Record given
    </button>
  );
}
