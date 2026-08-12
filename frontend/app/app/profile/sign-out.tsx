'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      className="btn-ghost w-full min-h-[50px] text-danger-fg"
      onClick={async () => {
        await fetch('/api/session', { method: 'DELETE' });
        router.replace('/login');
        router.refresh();
      }}
    >
      <Icon name="logout" size={18} />Sign out
    </button>
  );
}
