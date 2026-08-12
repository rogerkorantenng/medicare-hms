'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon } from '@/components/ui';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      className="btn-ghost w-full min-h-[50px] text-danger-fg"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      <Icon name="logout" size={18} />Sign out
    </button>
  );
}
