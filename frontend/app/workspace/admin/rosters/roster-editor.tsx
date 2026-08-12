'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import {
  addShiftAction, bookLeaveAction, cancelLeaveAction, removeShiftAction,
} from '@/app/actions';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Props =
  | { mode: 'add-shift'; doctorId: string }
  | { mode: 'remove-shift'; shiftId: number }
  | { mode: 'add-leave'; doctorId: string }
  | { mode: 'remove-leave'; leaveId: number };

export function RosterEditor(props: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function run(work: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    const result = await work();
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); router.refresh(); }
  }

  if (props.mode === 'remove-shift' || props.mode === 'remove-leave') {
    const label = props.mode === 'remove-shift' ? 'Remove' : 'Cancel leave';
    return (
      <button className="btn-ghost text-support" disabled={busy}
              onClick={() => run(() => props.mode === 'remove-shift'
                ? removeShiftAction(props.shiftId)
                : cancelLeaveAction(props.leaveId))}>
        <Icon name="close" size={16} />{label}
      </button>
    );
  }

  const isShift = props.mode === 'add-shift';

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="add" size={16} />{isShift ? 'Add a clinic' : 'Book leave'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            className="panel w-full max-w-md p-6 animate-fadeUp"
            action={(form) => run(() => isShift
              ? addShiftAction({
                doctorId: props.doctorId,
                dayOfWeek: Number(form.get('dayOfWeek')),
                startsAt: String(form.get('startsAt')),
                endsAt: String(form.get('endsAt')),
                slotMinutes: Number(form.get('slotMinutes')) || 30,
              })
              : bookLeaveAction(
                props.doctorId,
                String(form.get('startsOn')),
                String(form.get('endsOn')),
                String(form.get('reason')) || undefined,
              ))}
          >
            <h3 className="text-section">{isShift ? 'Add a clinic' : 'Book leave'}</h3>
            <p className="text-support text-ink-soft mt-1">
              {isShift
                ? 'Slots are generated across this window at the interval you choose.'
                : 'The doctor has no bookable slots at all on these days.'}
            </p>

            <div className="grid grid-cols-2 gap-3.5 mt-5">
              {isShift ? (
                <>
                  <div className="field col-span-2">
                    <label htmlFor="dayOfWeek">Day</label>
                    <select id="dayOfWeek" name="dayOfWeek" defaultValue={1}>
                      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="startsAt">From</label>
                    <input id="startsAt" name="startsAt" type="time" defaultValue="09:00" required />
                  </div>
                  <div className="field">
                    <label htmlFor="endsAt">To</label>
                    <input id="endsAt" name="endsAt" type="time" defaultValue="12:00" required />
                  </div>
                  <div className="field col-span-2">
                    <label htmlFor="slotMinutes">Minutes per appointment</label>
                    <input id="slotMinutes" name="slotMinutes" className="val"
                           inputMode="numeric" defaultValue={30} />
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="startsOn">First day</label>
                    <input id="startsOn" name="startsOn" type="date" required />
                  </div>
                  <div className="field">
                    <label htmlFor="endsOn">Last day</label>
                    <input id="endsOn" name="endsOn" type="date" required />
                  </div>
                  <div className="field col-span-2">
                    <label htmlFor="reason">Reason</label>
                    <input id="reason" name="reason" placeholder="Annual leave" />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                <Icon name="save" size={18} />Save
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
