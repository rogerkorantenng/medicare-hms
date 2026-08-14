'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';
import { NAV } from '@/lib/nav';
import type { Role } from '@/lib/repository/types';

/**
 * The staff navigation.
 *
 * Two shapes, decided by the viewport rather than by the user agent. From
 * lg up it is a column in the page flow, collapsible to icons. Below lg a
 * 236px column would take most of a phone screen, so it slides in over
 * the content and a scrim closes it.
 *
 * Collapse only exists on the wide shape: on a drawer it would mean
 * making an overlay narrower, which helps nobody.
 */
export function SideBar({
  role, collapsed, onCollapse, open, onClose, onSignOut,
}: {
  role: Role;
  collapsed: boolean;
  onCollapse: () => void;
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const items = NAV[role] ?? [];

  const link = 'flex items-center gap-3 rounded-control px-3 py-2.5 transition';
  const quiet = 'text-white/70 hover:bg-white/10 hover:text-white';

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close the menu"
          onClick={onClose}
          className="lg:hidden fixed inset-0 z-40 bg-sidebar/50 no-print"
        />
      )}

      <aside
        /* sticky, not static: on a long page the sidebar used to scroll
           away with the content and take Collapse and Sign out with it. */
        className={`no-print bg-sidebar text-white flex flex-col transition-all duration-200
          fixed inset-y-0 left-0 z-50 w-[236px] h-screen
          lg:sticky lg:top-0 lg:z-auto lg:shrink-0 lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-[68px]' : 'lg:w-[236px]'}`}
      >
        <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-control bg-white/15 shrink-0">
            <Icon name="health_and_safety" size={20} filled />
          </span>
          <span className={`font-display font-extrabold ${collapsed ? 'lg:hidden' : ''}`}>
            MediCare+
          </span>
          <button
            onClick={onClose}
            aria-label="Close the menu"
            className="lg:hidden ml-auto text-white/70 hover:text-white"
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto">
          {items.map((item) => {
            const active = pathname === item.href
              || (item.href !== `/workspace/${role}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={`${link} ${active ? 'bg-white/15 text-white' : quiet}`}
              >
                <Icon name={item.icon} size={20} filled={active} />
                <span className={`text-body font-display font-semibold ${collapsed ? 'lg:hidden' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3 flex flex-col gap-1">
          <button onClick={onCollapse} className={`hidden lg:flex ${link} ${quiet}`}>
            <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size={20} />
            <span className={`text-body font-display font-semibold ${collapsed ? 'lg:hidden' : ''}`}>
              Collapse
            </span>
          </button>
          <button onClick={onSignOut} className={`${link} ${quiet}`}>
            <Icon name="logout" size={20} />
            <span className={`text-body font-display font-semibold ${collapsed ? 'lg:hidden' : ''}`}>
              Sign out
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
