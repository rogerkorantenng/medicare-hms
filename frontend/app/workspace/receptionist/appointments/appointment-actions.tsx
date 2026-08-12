'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { ReasonAction } from '@/components/reason-action';
import type { Appointment } from '@/lib/repository/types';
import {
  cancelAppointmentAction, didNotAttendAction, rescheduleAction, freeSlotsAction,
} from '@/app/actions';

/**
 * The rest of an appointment's life.
 *
 * 'cancelled' sat in the schema from the beginning and nothing could set
 * it, so a booking made in error stayed on the schedule forever and the
 * slot was never released.
 *
 * A no-show is recorded separately, because a cancellation frees the
 * slot and a no-show wastes it, and a clinic measuring utilisation needs
 * to tell them apart.
 */
export function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const open = appointment.status === 'confirmed' || appointment.status === 'checked_in';
  if (!open) return null;

  return (
    <div className="flex justify-end gap-1">
      <Reschedule appointment={appointment} />
      <ReasonAction
        label="Cancel" icon="close" tone="danger"
        title="Cancel this appointment"
        prompt={`${appointment.patientName ?? appointment.mrn} with ${appointment.doctorName}. The slot is released for somebody else.`}
        placeholder="Patient rang to cancel"
        confirmLabel="Cancel booking"
        perform={(reason) => cancelAppointmentAction(appointment.id, reason)}
      />
      <DidNotAttend appointment={appointment} />
    </div>
  );
}

function DidNotAttend({ appointment }: { appointment: Appointment }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function mark() {
    setBusy(true);
    const result = await didNotAttendAction(appointment.id);
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) router.refresh();
  }

  return (
    <button className="btn-ghost text-support" onClick={mark} disabled={busy}
            title="The patient did not arrive. The slot was held and wasted.">
      <Icon name="person" size={16} />No show
    </button>
  );
}

function Reschedule({ appointment }: { appointment: Appointment }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(appointment.apptDate.slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function load(next: string) {
    setDay(next);
    setSlot('');
    const result = await freeSlotsAction(appointment.doctorId, next);
    setSlots(result.slots);
  }

  async function submit() {
    if (!slot) return;
    setBusy(true);
    const result = await rescheduleAction(appointment.id, day, slot);
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) { setOpen(false); router.refresh(); }
  }

  return (
    <>
      <button className="btn-ghost text-support"
              onClick={() => { setOpen(true); load(day); }}>
        <Icon name="calendar_month" size={16} />Move
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4"
             onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-md p-6 animate-fadeUp"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-section">Move this appointment</h3>
            <p className="text-support text-ink-soft mt-1">
              {appointment.patientName ?? appointment.mrn} with {appointment.doctorName}.
              Only times the doctor is actually working are offered.
            </p>

            <div className="field mt-5">
              <label htmlFor="day">Day</label>
              <input id="day" type="date" value={day}
                     onChange={(e) => load(e.target.value)} />
            </div>

            <div className="mt-4">
              <p className="label mb-2">Free slots</p>
              {slots.length === 0 ? (
                <p className="text-support text-ink-soft">
                  Nothing free that day. The doctor may not have a clinic, or may
                  be on leave.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button key={s} onClick={() => setSlot(s)}
                            className={`val rounded-control border py-2 text-support transition ${
                              s === slot
                                ? 'border-primary bg-primary-tint text-primary'
                                : 'border-hairline hover:bg-surface-row'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={submit} disabled={!slot || busy}>
                <Icon name="save" size={18} />Move it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
