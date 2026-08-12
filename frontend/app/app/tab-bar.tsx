'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';

/** Five tabs. The filled icon variant marks the active one. */
const TABS = [
  { href: '/app', label: 'Home', icon: 'home' },
  { href: '/app/book', label: 'Book', icon: 'event' },
  { href: '/app/records', label: 'Records', icon: 'folder' },
  { href: '/app/alerts', label: 'Alerts', icon: 'notifications' },
  { href: '/app/profile', label: 'Profile', icon: 'person' },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 w-full max-w-[430px] bg-white border-t border-hairline flex no-print z-30"
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
