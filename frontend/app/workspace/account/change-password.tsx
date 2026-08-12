'use client';

import { useState } from 'react';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { changePasswordAction } from '@/app/actions';

const MINIMUM = 12;

export function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Checked here so the person sees it as they type; the API checks the
  // same things again, because this copy can be bypassed.
  const tooShort = next.length > 0 && next.length < MINIMUM;
  const mismatch = confirm.length > 0 && next !== confirm;
  const unchanged = next.length > 0 && next === current;
  const ready = next.length >= MINIMUM && next === confirm && !unchanged && current.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await changePasswordAction(current, next);
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setCurrent(''); setNext(''); setConfirm('');
    toast('Password changed. Use it next time you sign in.');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-md">
      <div className="field">
        <label htmlFor="current">Current password</label>
        <input id="current" type={show ? 'text' : 'password'} autoComplete="current-password"
               value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>

      <div className="field">
        <label htmlFor="next">New password</label>
        <input id="next" type={show ? 'text' : 'password'} autoComplete="new-password"
               value={next} onChange={(e) => setNext(e.target.value)} required />
        <p className={`text-chip ${tooShort ? 'text-danger-fg' : 'text-ink-soft'}`}>
          At least {MINIMUM} characters. A phrase you can remember beats a short
          one you cannot.
        </p>
      </div>

      <div className="field">
        <label htmlFor="confirm">New password again</label>
        <input id="confirm" type={show ? 'text' : 'password'} autoComplete="new-password"
               value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {mismatch && <p className="text-chip text-danger-fg">These do not match.</p>}
        {unchanged && (
          <p className="text-chip text-danger-fg">
            That is your current password. Choose a different one.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-support text-ink-soft">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show what I am typing
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-control border border-danger-br bg-danger-bg px-3 py-2 text-support text-danger-fg">
          <Icon name="error" size={16} className="mt-px" />{error}
        </p>
      )}

      <button className="btn-primary self-start" disabled={!ready || busy}>
        <Icon name="lock" size={18} />Change password
      </button>
    </form>
  );
}
