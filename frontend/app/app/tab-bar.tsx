'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';
import { TABS } from './tabs';

/**
 * The bottom bar, on phones only. A wide screen gets the sidebar in
 * side-nav.tsx instead, which is the same five destinations in a shape
 * that suits a mouse.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 mx-auto w-full max-w-[430px] bg-white border-t border-hairline flex no-print z-30"
      aria-label="Main"
    >
      {TABS.map((t) => {
        const active = t.href === '/app' ? pathname === '/app' : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            /* 44px minimum touch target, plus room for the home indicator. */
            className={`flex-1 min-h-[56px] pb-2 pt-2 flex flex-col items-center justify-center gap-0.5 transition
              ${active ? 'text-primary' : 'text-ink-faint'}`}
          >
            <Icon name={t.icon} size={22} filled={active} />
            <span className="text-m-chip font-display font-bold">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
