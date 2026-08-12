'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV, ROLE_LABEL, TOUR } from '@/lib/nav';
import { Icon, Avatar } from '@/components/ui';
import type { Role } from '@/lib/repository/types';
import { CommandPalette } from './command-palette';
import { NotificationBell } from './notifications';

// ---------- toast ----------
// Confirms every write within one second. Bottom right, dark.

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 no-print" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fadeUp flex items-start gap-2.5 rounded-control bg-sidebar text-white px-4 py-3 shadow-raised max-w-sm"
        >
          <Icon
            name={t.tone === 'ok' ? 'check_circle' : 'error'}
            size={18}
            className={t.tone === 'ok' ? 'text-success-br' : 'text-danger-br'}
            filled
          />
          <span className="text-support">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- clock ----------

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // Rendered only after mount, so the server and client cannot disagree.
  if (!now) return <span className="val text-support text-ink-soft w-[9.5rem]" />;
  return (
    <span className="val text-support text-ink-soft whitespace-nowrap">
      {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
      {' · '}
      {now.toLocaleTimeString('en-GB')}
    </span>
  );
}

// ---------- welcome tour ----------

function WelcomeTour({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const key = `medicare.tour.${role}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(key)) setOpen(true);
  }, [key]);

  if (!open) return null;
  const points = TOUR[role] ?? [];

  function dismiss() {
    localStorage.setItem(key, 'seen');
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 no-print">
      <div className="panel max-w-lg w-full p-6 animate-fadeUp shadow-modal">
        <p className="chip-info mb-3">First sign-in</p>
        <h2 className="text-section">Three things about the {ROLE_LABEL[role]} workspace</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {points.map((p, i) => (
            <li key={p} className="flex gap-3">
              <span className="val grid place-items-center w-6 h-6 shrink-0 rounded-full bg-primary-tint text-primary text-chip">
                {i + 1}
              </span>
              <span className="text-body text-ink/90">{p}</span>
            </li>
          ))}
        </ul>
        <button onClick={dismiss} className="btn-primary w-full mt-6">Start work</button>
      </div>
    </div>
  );
}

// ---------- shell ----------

export function Shell({
  role, fullName, department, children,
}: {
  role: Role; fullName: string; department: string | null; children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function signOut() {
    // The session cookie is httpOnly, so only the server can clear it.
    await fetch('/api/session', { method: 'DELETE' });
    router.replace('/login');
    router.refresh();
  }

  const items = NAV[role] ?? [];

  return (
    <ToastCtx.Provider value={push}>
      <div className="min-h-screen flex">
        {/* Sidebar */}
        <aside
          className={`no-print shrink-0 bg-sidebar text-white flex flex-col transition-all duration-200
            ${collapsed ? 'w-[68px]' : 'w-[236px]'}`}
        >
          <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
            <span className="grid place-items-center w-9 h-9 rounded-control bg-white/15 shrink-0">
              <Icon name="health_and_safety" size={20} filled />
            </span>
            {!collapsed && <span className="font-display font-extrabold">MediCare+</span>}
          </div>

          <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto">
            {items.map((item) => {
              const active = pathname === item.href
                || (item.href !== `/workspace/${role}` && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-control px-3 py-2.5 transition
                    ${active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                >
                  <Icon name={item.icon} size={20} filled={active} />
                  {!collapsed && <span className="text-body font-display font-semibold">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 pb-3 flex flex-col gap-1">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex items-center gap-3 rounded-control px-3 py-2.5 text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size={20} />
              {!collapsed && <span className="text-body font-display font-semibold">Collapse</span>}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-3 rounded-control px-3 py-2.5 text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              <Icon name="logout" size={20} />
              {!collapsed && <span className="text-body font-display font-semibold">Sign out</span>}
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="no-print sticky top-0 z-30 h-16 shrink-0 bg-white/85 backdrop-blur border-b border-hairline flex items-center gap-3 px-5">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-control border border-hairline bg-surface-wash px-3 py-2 text-ink-faint hover:bg-white transition min-w-0 flex-1 max-w-sm"
            >
              <Icon name="search" size={18} />
              <span className="text-support truncate">Search patients and screens</span>
              <span className="val ml-auto text-chip border border-hairline rounded px-1.5 py-0.5 hidden sm:block">
                ⌘K
              </span>
            </button>

            <div className="ml-auto flex items-center gap-3">
              <LiveClock />
              <NotificationBell />
              {/* The whole block is the link to your account, so the
                  obvious place to click for "my details" is the one that
                  already shows them. */}
              <Link
                href="/workspace/account"
                className="flex items-center gap-2.5 pl-3 border-l border-hairline rounded-control py-1 pr-2 hover:bg-surface-row transition"
                title="Your account"
              >
                <Avatar name={fullName} size={34} />
                <div className="hidden sm:block leading-tight">
                  <p className="text-support font-display font-bold">{fullName}</p>
                  <p className="text-chip text-ink-soft">
                    {ROLE_LABEL[role]}{department ? ` · ${department}` : ''}
                  </p>
                </div>
              </Link>
            </div>
          </header>

          <main className="flex-1 p-5 sm:p-7 max-w-[1500px] w-full">{children}</main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={role} />
      <WelcomeTour role={role} />
      <ToastHost toasts={toasts} />
    </ToastCtx.Provider>
  );
}
