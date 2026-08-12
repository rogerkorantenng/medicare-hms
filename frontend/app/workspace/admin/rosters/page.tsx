import { repo } from '@/lib/repository';
import { PageHeader, Card, Chip, onlyDate } from '@/components/ui';
import { RosterEditor } from './roster-editor';

export const dynamic = 'force-dynamic';

/**
 * Who works when.
 *
 * free_slots() used to be ten hardcoded times in SQL, offered to every
 * doctor every day, weekends included, whether or not they were on
 * leave. Booking is the front door of the system, so that was the most
 * visible piece of fiction in it.
 */
export default async function Rosters({
  searchParams,
}: { searchParams: { doctor?: string } }) {
  const staff = await repo.staffDirectory();
  const doctors = staff.filter((s) => s.role === 'doctor' && s.isActive !== false);
  const selected = searchParams.doctor ?? doctors[0]?.id;
  const roster = selected ? await repo.roster(selected) : { shifts: [], leave: [] };
  const doctor = doctors.find((d) => d.id === selected);

  return (
    <>
      <PageHeader
        title="Clinics and leave"
        subtitle="A doctor with no clinic on a day is not working that day. Booking reads this, so a slot only exists if somebody is there to fill it."
      />

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-5 items-start">
        <Card title="Doctors">
          <ul className="flex flex-col gap-1">
            {doctors.map((d) => (
              <li key={d.id}>
                <a
                  href={`/workspace/admin/rosters?doctor=${d.id}`}
                  className={`block rounded-control px-3 py-2 transition ${
                    d.id === selected
                      ? 'bg-primary-tint text-primary font-display font-bold'
                      : 'hover:bg-surface-row'}`}
                >
                  <span className="block truncate">{d.fullName}</span>
                  <span className="block text-chip text-ink-soft">{d.department}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title={doctor ? `${doctor.fullName} · weekly clinics` : 'Clinics'}>
            {roster.shifts.length === 0 ? (
              <p className="text-support text-ink-soft">
                No clinics set, so this doctor has no bookable slots at all.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {roster.shifts.map((shift) => (
                  <li key={shift.id}
                      className="rounded-row border border-hairline p-3 flex items-center gap-3">
                    <span className="font-display font-bold w-24">{shift.dayName}</span>
                    <span className="val text-support">
                      {shift.startsAt.slice(0, 5)} to {shift.endsAt.slice(0, 5)}
                    </span>
                    <Chip tone="neutral">{shift.slotMinutes} min slots</Chip>
                    <span className="ml-auto">
                      <RosterEditor mode="remove-shift" shiftId={shift.id} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <div className="mt-4"><RosterEditor mode="add-shift" doctorId={selected} /></div>
            )}
          </Card>

          <Card title="Leave">
            {roster.leave.length === 0 ? (
              <p className="text-support text-ink-soft">None booked.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {roster.leave.map((entry) => (
                  <li key={entry.id}
                      className="rounded-row border border-hairline p-3 flex items-center gap-3">
                    <span className="val text-support">
                      {onlyDate(entry.startsOn)} to {onlyDate(entry.endsOn)}
                    </span>
                    <span className="text-ink-soft">{entry.reason ?? 'Leave'}</span>
                    <span className="ml-auto">
                      <RosterEditor mode="remove-leave" leaveId={entry.id} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <div className="mt-4"><RosterEditor mode="add-leave" doctorId={selected} /></div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
