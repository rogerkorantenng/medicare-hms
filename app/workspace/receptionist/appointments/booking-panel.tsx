'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bookAppointmentAction, freeSlotsAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Card, Icon } from '@/components/ui';
import type { Patient, Staff } from '@/lib/repository/types';

/** The full roster of slots. What is bookable is whatever the database says. */
const ALL_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'];

export function BookingPanel({ doctors }: { doctors: Staff[] }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '');
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [free, setFree] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [type, setType] = useState('Consultation');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  // freeSlots queries the roster AND the bookings. Reading only the roster
  // was defect D-03.
  useEffect(() => {
    if (!doctorId || !date) return;
    let cancelled = false;
    (async () => {
      const r = await freeSlotsAction(doctorId, date);
      if (!cancelled) { setFree(r.slots); setSlot(''); }
    })();
    return () => { cancelled = true; };
  }, [doctorId, date]);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
      setResults((await res.json()).patients ?? []);
    } catch { setResults([]); }
  }

  function book() {
    if (!patient || !slot) return;
    start(async () => {
      const doctor = doctors.find((d) => d.id === doctorId);
      const r = await bookAppointmentAction({
        mrn: patient.mrn, doctorId, specialty: doctor?.department ?? null,
        apptDate: date, apptTime: slot, apptType: type,
      });
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) {
        setSlot('');
        const refreshed = await freeSlotsAction(doctorId, date);
        setFree(refreshed.slots);
        router.refresh();
      }
    });
  }

  return (
    <Card title="Book an appointment">
      <div className="flex flex-col gap-4">
        {/* Patient */}
        <div className="field">
          <label htmlFor="pq">Patient</label>
          {patient ? (
            <div className="flex items-center gap-2 rounded-control bg-primary-tint px-3 py-2">
              <span className="flex-1 min-w-0">
                <span className="block text-body font-semibold truncate">{patient.fullName}</span>
                <span className="val block text-chip text-primary">{patient.mrn}</span>
              </span>
              <button onClick={() => { setPatient(null); setQuery(''); }} aria-label="Clear patient">
                <Icon name="close" size={16} className="text-primary" />
              </button>
            </div>
          ) : (
            <>
              <input id="pq" value={query} onChange={(e) => search(e.target.value)}
                     placeholder="Name or MRN" />
              {results.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-y-auto flex flex-col gap-0.5">
                  {results.map((p) => (
                    <li key={p.mrn}>
                      <button
                        className="w-full text-left rounded-control px-3 py-2 hover:bg-surface-row"
                        onClick={() => { setPatient(p); setResults([]); }}
                      >
                        <span className="block text-support font-semibold">{p.fullName}</span>
                        <span className="val block text-chip text-ink-soft">{p.mrn}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="field">
          <label htmlFor="doc">Doctor</label>
          <select id="doc" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName} — {d.department}{d.onDuty ? '' : ' (off duty)'}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" className="val" value={date}
                 min={new Date().toISOString().slice(0, 10)}
                 onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <p className="label mb-2">Slot</p>
          <div className="grid grid-cols-3 gap-2">
            {ALL_SLOTS.map((s) => {
              const taken = !free.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={taken}
                  onClick={() => setSlot(s)}
                  aria-label={taken ? `${s}, already booked` : s}
                  className={`val rounded-control border px-2 py-2 text-support transition
                    ${taken
                      ? 'line-through text-ink-disabled bg-surface-wash border-hairline cursor-not-allowed'
                      : slot === s
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white border-hairline hover:bg-surface-row'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <p className="text-support text-ink-soft mt-2">
            Struck-through slots are already booked for this doctor on this date.
          </p>
        </div>

        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option>Consultation</option><option>Follow-up</option><option>Review</option>
          </select>
        </div>

        <button className="btn-primary w-full py-2.5" disabled={!patient || !slot || pending} onClick={book}>
          {pending ? <Icon name="progress_activity" className="animate-spin" size={18} /> : <Icon name="event_available" size={18} />}
          Book appointment
        </button>
      </div>
    </Card>
  );
}
