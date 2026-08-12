'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import type { Patient } from '@/lib/repository/types';
import { fileDocumentAction, grantPortalAccessAction } from '@/app/actions';
import { suggestPassword } from '@/app/workspace/admin/staff/staff-password';

const KINDS = [
  ['referral', 'Referral letter'], ['consent', 'Consent form'],
  ['report', 'Report'], ['letter', 'Letter'], ['other', 'Other'],
];

/**
 * Filing a document.
 *
 * `documents` was only ever written by discharge_patient, so a referral
 * letter or a consent form had nowhere to go at all. Typed rather than
 * uploaded: there is no file storage in this deployment, and an upload
 * button that silently discarded a scan would be worse than a text field
 * that keeps what it is given.
 */
export function FileDocument({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setBusy(true);
    const result = await fileDocumentAction({
      mrn: patient.mrn,
      title: String(form.get('title')).trim(),
      kind: String(form.get('kind')),
      body: String(form.get('body')),
    });
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); router.refresh(); }
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="folder" size={16} />File a document
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 overflow-y-auto"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-xl p-6 my-8 animate-fadeUp">
            <h3 className="text-section">File a document</h3>
            <p className="text-support text-ink-soft mt-1">
              {patient.fullName} · <span className="val">{patient.mrn}</span>
            </p>
            <div className="grid sm:grid-cols-2 gap-3.5 mt-5">
              <div className="field">
                <label htmlFor="kind">Kind</label>
                <select id="kind" name="kind" defaultValue="referral">
                  {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="title">Title</label>
                <input id="title" name="title" required minLength={2}
                       placeholder="Referral to Cardiology" />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="body">Content</label>
                <textarea id="body" name="body" rows={8} required
                          placeholder="Type or paste the letter here." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="save" size={18} />File it
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/**
 * Giving a patient access to the application built for them.
 *
 * Only the seeded account could sign in. Register somebody at the desk
 * today and they could never reach the mobile app, which is a promise
 * the system was making and not keeping.
 */
export function GrantPortalAccess({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  const [password] = useState(suggestPassword);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    const result = await grantPortalAccessAction(
      patient.mrn, String(form.get('email')).trim(), password);
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    toast(`Account created. Password: ${password}`);
    router.refresh();
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="smartphone" size={16} />App access
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-md p-6 animate-fadeUp">
            <h3 className="text-section">Give {patient.fullName} app access</h3>
            <p className="text-support text-ink-soft mt-1">
              They will be able to see their own results, book appointments and
              pay bills. They are asked to change the password at first use.
            </p>
            <div className="field mt-5">
              <label htmlFor="email">Their email address</label>
              <input id="email" name="email" type="email" required
                     placeholder="name@example.com" />
            </div>
            <div className="mt-4 rounded-control border border-hairline bg-surface-wash p-3">
              <p className="label mb-1.5">Temporary password</p>
              <code className="val text-body tracking-wide">{password}</code>
              <p className="text-chip text-ink-soft mt-2">
                Shown once. Write it down or hand them the screen.
              </p>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-control border border-danger-br bg-danger-bg px-3 py-2 text-support text-danger-fg">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="smartphone" size={18} />Create account
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
