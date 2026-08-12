'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';

export function ForgotForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    setBusy(true);
    // Posted through this application rather than to the API directly, so
    // the browser never learns the API's address. The answer is the same
    // whether or not the address is registered.
    const response = await fetch('/api/session/forgot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    setSent(body?.message
      ?? 'If that address is registered, reception can reset it for you.');
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-card border border-success-br bg-success-bg p-4">
        <p className="flex items-start gap-2 text-support text-success-fg">
          <Icon name="check_circle" size={18} className="mt-px" />
          {sent}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" required
               autoComplete="username" placeholder="you@example.com" />
      </div>
      <button className="btn-primary" disabled={busy}>
        <Icon name="send" size={18} />
        {busy ? 'Sending' : 'Ask reception to reset it'}
      </button>
    </form>
  );
}
