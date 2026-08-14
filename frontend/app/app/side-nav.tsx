'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Avatar } from '@/components/ui';
import { SignOutButton } from './profile/sign-out';
import { TABS } from './tabs';

/**
 * The patient navigation on a wide screen.
 *
 * The application used to render as a 430px column in the middle of a
 * desktop monitor, which is what you get when a mobile-first layout is
 * pinned rather than allowed to grow. Same routes, same data; the shape
 * follows the viewport.
 *
 * Doing it in CSS rather than by sniffing the user agent means a phone
 * held sideways, a tablet, and a browser window somebody has dragged
 * narrow all behave the way their width says they should.
 */
export function SideNav({ name, mrn }: { name: string; mrn: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[248px] shrink-0 flex-col gap-1 p-4 border-r border-hairline bg-white no-print">
      <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
        <span className="grid place-items-center w-9 h-9 rounded-control bg-primary text-white">
          <Icon name="health_and_safety" size={20} filled />
        </span>
        <span className="font-display font-extrabold">MediCare+</span>
      </div>

      <div className="flex items-center gap-2.5 px-2 py-2 mb-3 rounded-control bg-surface-wash">
        <Avatar name={name} size={36} />
        <div className="min-w-0">
          <p className="font-display font-bold text-support truncate">{name}</p>
          {mrn && <p className="val text-chip text-ink-soft">{mrn}</p>}
        </div>
      </div>

      {TABS.map((tab) => {
        const active = tab.href === '/app'
          ? pathname === '/app'
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-control px-3 min-h-[46px] transition ${
              active
                ? 'bg-primary text-white font-display font-bold'
                : 'text-ink-soft hover:bg-surface-row'}`}
          >
            <Icon name={tab.icon} size={20} filled={active} />
            {tab.label}
          </Link>
        );
      })}

      {/* Staff sign out from their sidebar, so a patient on a wide screen
          should be able to as well. On a phone there is no sidebar and it
          stays where a phone user looks for it, on the profile tab. */}
      <div className="mt-auto pt-2">
        <SignOutButton />
      </div>

      <p className="text-chip text-ink-faint px-2 leading-relaxed">
        All data here is synthetic. No real patient data appears anywhere.
      </p>
    </aside>
  );
}
