'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { bookAppointmentAction, freeSlotsAction } from '@/app/actions';
import { Icon, Avatar, onlyDate } from '@/components/ui';
import type { Staff } from '@/lib/repository/types';

const ALL_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'];

/** A stable pseudo-rating, so the roster reads like the design without inventing data per render. */
const rating = (id: string) => (4.5 + (id.charCodeAt(0) % 5) / 10).toFixed(1);

function nextDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

export function BookFlow({
  doctors, mrn, preferredSpecialty,
}: { doctors: Staff[]; mrn: string; preferredSpecialty: string | null }) {
  const preferred = preferredSpecialty
    ? doctors.find((d) => d.department === preferredSpecialty) ?? doctors[0]
    : doctors[0];

  const [doctor, setDoctor] = useState<Staff | undefined>(preferred);
  const [date, setDate] = useState(() => nextDays(1)[0].toISOString().slice(0, 10));
  const [free, setFree] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [done, setDone] = useState<{ time: string; date: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!doctor) return;
    let cancelled = false;
    (async () => {
      const r = await freeSlotsAction(doctor.id, date);
      if (!cancelled) { setFree(r.slots); setSlot(''); }
    })();
    return () => { cancelled = true; };
  }, [doctor, date]);

  function confirm() {
    if (!doctor || !slot) return;
    setError(null);
    start(async () => {
      const r = await bookAppointmentAction({
        mrn, doctorId: doctor.id, specialty: doctor.department,
        apptDate: date, apptTime: slot, apptType: 'Consultation',
      });
      if (r.ok) setDone({ time: slot, date });
      else {
        setError(r.message);
        const refreshed = await freeSlotsAction(doctor.id, date);
        setFree(refreshed.slots);
        setSlot('');
      }
    });
  }

  if (done) {
    return (
      <div className="px-5 py-10 text-center">
        <span className="grid place-items-center w-20 h-20 mx-auto rounded-full bg-success-bg text-success-fg">
          <Icon name="check_circle" size={38} filled />
        </span>
        <h2 className="text-m-section mt-4">You are booked</h2>
        <p className="text-m-body text-ink-soft mt-2">
          {doctor?.fullName} · {doctor?.department}
        </p>
        <p className="val text-lg font-bold mt-1">{onlyDate(done.date)} at {done.time}</p>
        <p className="text-m-support text-ink-soft mt-4">
          Come to reception a few minutes early to check in.
        </p>
        <Link href="/app" className="btn-primary w-full mt-6 min-h-[48px]">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-8 py-5 flex flex-col gap-5">
      {/* Doctors */}
      <section>
        <h2 className="text-m-section mb-2.5">Choose a doctor</h2>
        <ul className="flex flex-col gap-2">
          {doctors.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setDoctor(d)}
                aria-pressed={doctor?.id === d.id}
                className={`w-full flex items-center gap-3 rounded-card border p-3.5 min-h-[68px] text-left transition
                  ${doctor?.id === d.id ? 'border-primary bg-primary-tint' : 'border-hairline bg-white'}`}
              >
                <Avatar name={d.fullName} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold truncate">{d.fullName}</p>
                  <p className="text-m-support text-ink-soft">{d.department}</p>
                </div>
                <span className="flex items-center gap-1 text-m-support">
                  <Icon name="star" size={15} className="text-warning-fg" filled />
                  <span className="val">{rating(d.id)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Date strip */}
      <section>
        <h2 className="text-m-section mb-2.5">Pick a date</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
          {nextDays(14).map((d) => {
            const iso = d.toISOString().slice(0, 10);
            const active = iso === date;
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                className={`shrink-0 w-[58px] min-h-[68px] rounded-card border flex flex-col items-center justify-center gap-0.5 transition
                  ${active ? 'border-primary bg-primary text-white' : 'border-hairline bg-white'}`}
              >
                <span className="text-m-chip uppercase font-bold opacity-70">
                  {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                <span className="val text-lg font-extrabold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Slots */}
      <section>
        <h2 className="text-m-section mb-2.5">Available times</h2>
        <div className="grid grid-cols-3 gap-2">
          {ALL_SLOTS.map((s) => {
            const taken = !free.includes(s);
            return (
              <button
                key={s}
                disabled={taken}
                onClick={() => setSlot(s)}
                aria-label={taken ? `${s}, already taken` : s}
                className={`val min-h-[46px] rounded-control border transition
                  ${taken
                    ? 'line-through text-ink-disabled bg-surface-wash border-hairline'
                    : slot === s
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white border-hairline'}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-control border border-danger-br bg-danger-bg px-3 py-2.5 text-m-support text-danger-fg">
          {error}
        </p>
      )}

      <button className="btn-primary w-full min-h-[50px]" disabled={!slot || pending} onClick={confirm}>
        {pending ? <Icon name="progress_activity" className="animate-spin" size={18} /> : <Icon name="event_available" size={18} />}
        Confirm booking
      </button>
    </div>
  );
}
