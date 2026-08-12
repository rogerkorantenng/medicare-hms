'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon } from '@/components/ui';

type RoleOption = { email: string; label: string; icon: string; dept: string };

export function LoginForm({ roles }: { roles: RoleOption[] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const params = useSearchParams();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        /invalid login credentials/i.test(error.message)
          ? 'That email and password do not match an account.'
          : error.message,
      );
      return;
    }

    const role = (data.user?.app_metadata?.role as string) ?? 'patient';
    const next = params.get('next');
    const home = role === 'patient' ? '/app' : `/workspace/${role}`;

    start(() => {
      router.replace(next && next !== '/' ? next : home);
      router.refresh();
    });
  }

  return (
    <form onSubmit={signIn} className="mt-7 flex flex-col gap-5">
      <div>
        <p className="label mb-2">Role accounts</p>
        <div className="grid grid-cols-3 gap-2">
          {roles.map((r) => {
            const active = email === r.email;
            return (
              <button
                key={r.email}
                type="button"
                onClick={() => { setEmail(r.email); setError(null); }}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-control border px-2 py-2.5 transition
                  ${active
                    ? 'border-primary bg-primary-tint text-primary'
                    : 'border-hairline bg-white text-ink-soft hover:bg-surface-row'}`}
              >
                <Icon name={r.icon} size={20} filled={active} />
                <span className="text-chip font-display">{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@medicare.com"
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-control border border-danger-br bg-danger-bg px-3 py-2 text-support text-danger-fg">
          <Icon name="error" size={16} className="mt-px" />
          {error}
        </p>
      )}

      <button className="btn-primary w-full py-2.5" disabled={pending}>
        {pending ? <Icon name="progress_activity" className="animate-spin" size={18} /> : <Icon name="login" size={18} />}
        {pending ? 'Signing in' : 'Sign in'}
      </button>

      <p className="text-support text-ink-faint text-center">
        All data is synthetic. No real patient data appears anywhere.
      </p>
    </form>
  );
}
