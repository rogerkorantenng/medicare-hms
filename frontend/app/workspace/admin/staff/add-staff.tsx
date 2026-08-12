'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/repository/types';
import { createStaffAction } from '@/app/actions';
import { suggestPassword } from './staff-password';
import { STAFF_ROLES, DEPARTMENTS } from './staff-options';

export function AddStaff() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(suggestPassword);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  async function submit(form: FormData) {
    setError(null);
    const result = await createStaffAction({
      email: String(form.get('email')).trim(),
      fullName: String(form.get('fullName')).trim(),
      role: String(form.get('role')) as Role,
      department: String(form.get('department')) || null,
      password,
    });
    if (!result.ok) { setError(result.message); return; }
    // Shown in a toast because it is the only time it is ever visible:
    // the server keeps a hash and cannot tell anyone what it was.
    toast(`Account created. Password: ${password}`);
    start(() => { setOpen(false); setPassword(suggestPassword()); router.refresh(); });
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Icon name="person_add" size={18} />Add staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4 overflow-y-auto"
             onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
                className="panel w-full max-w-xl p-6 my-8 animate-fadeUp">
            <h3 className="text-section">Add a staff member</h3>
            <p className="text-support text-ink-soft mt-1">
              This creates a sign-in account. They can use the system as soon as
              you hand over the password.
            </p>

            <div className="grid sm:grid-cols-2 gap-3.5 mt-5">
              <div className="field sm:col-span-2">
                <label htmlFor="fullName">Full name</label>
                <input id="fullName" name="fullName" required minLength={2}
                       placeholder="Dr. Ama Boateng" />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="email">Work email</label>
                <input id="email" name="email" type="email" required
                       placeholder="ama.boateng@medicare.com" />
              </div>
              <div className="field">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" defaultValue="nurse">
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="department">Department</label>
                <select id="department" name="department" defaultValue="Outpatient">
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-control border border-hairline bg-surface-wash p-3">
              <p className="label mb-1.5">Temporary password</p>
              <div className="flex items-center gap-2">
                <code className="val text-body flex-1 tracking-wide">{password}</code>
                <button type="button" className="btn-ghost"
                        onClick={() => setPassword(suggestPassword())}>
                  Generate another
                </button>
              </div>
              <p className="text-chip text-ink-soft mt-2">
                Visible once. The system stores only a hash, so it cannot be
                looked up later, only reset.
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-control border border-danger-br bg-danger-bg px-3 py-2 text-support text-danger-fg">
                <Icon name="error" size={16} className="mt-px" />{error}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={pending}>
                <Icon name="person_add" size={18} />Create account
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
