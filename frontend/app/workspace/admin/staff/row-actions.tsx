'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon, Chip } from '@/components/ui';
import type { Staff, StaffPatch } from '@/lib/repository/types';
import { updateStaffAction, resetStaffPasswordAction } from '@/app/actions';
import { suggestPassword } from './staff-password';

/**
 * Duty, deactivation and password reset, per row.
 *
 * An administrator cannot deactivate or demote themselves: the API refuses
 * it, and the control is hidden here so nobody tries. Deactivation is the
 * only removal there is, because clinical actions reference their author
 * and a deleted author breaks the audit trail.
 */
export function StaffRowActions({ member, isSelf }: { member: Staff; isSelf: boolean }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function patch(change: StaffPatch, done: string) {
    setBusy(true);
    const result = await updateStaffAction(member.id, change);
    setBusy(false);
    toast(result.ok ? done : result.message, result.ok ? 'ok' : 'error');
    if (result.ok) router.refresh();
  }

  async function resetPassword() {
    const next = suggestPassword();
    setBusy(true);
    const result = await resetStaffPasswordAction(member.id, next);
    setBusy(false);
    toast(result.ok ? `New password for ${member.fullName}: ${next}` : result.message,
          result.ok ? 'ok' : 'error');
  }

  if (member.isActive === false) {
    return (
      <button className="btn-ghost text-support" disabled={busy}
              onClick={() => patch({ isActive: true }, `${member.fullName} reactivated.`)}>
        <Icon name="how_to_reg" size={16} />Reactivate
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <button className="btn-ghost text-support" disabled={busy}
              title={member.onDuty ? 'Mark off duty' : 'Mark on duty'}
              onClick={() => patch({ onDuty: !member.onDuty },
                member.onDuty ? `${member.fullName} is off duty.`
                              : `${member.fullName} is on duty.`)}>
        <Icon name={member.onDuty ? 'block' : 'check_circle'} size={16} />
        {member.onDuty ? 'Off duty' : 'On duty'}
      </button>

      <button className="btn-ghost text-support" disabled={busy} onClick={resetPassword}
              title="Set a new password">
        <Icon name="lock" size={16} />Reset
      </button>

      {isSelf
        ? <Chip tone="neutral">You</Chip>
        : (
          <button className="btn-ghost text-support !text-danger-fg" disabled={busy}
                  title="Block sign-in, keeping the record"
                  onClick={() => patch({ isActive: false }, `${member.fullName} deactivated.`)}>
            <Icon name="block" size={16} />Deactivate
          </button>
        )}
    </div>
  );
}
