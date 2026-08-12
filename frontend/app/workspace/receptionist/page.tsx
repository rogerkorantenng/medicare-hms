import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, Avatar, StatusChip } from '@/components/ui';
import { CheckInButton, WalkInDialog } from './front-desk-actions';

export const dynamic = 'force-dynamic';

/** Today's expected patients. Checking in moves them to the triage queue. */
export default async function FrontDesk() {
  const today = new Date().toISOString().slice(0, 10);

  const rows = (await repo.listAppointments({ since: today }))
    .filter((a) => a.apptDate.slice(0, 10) === today);
  const expected = rows.filter((r) => r.status === 'confirmed');
  const arrived = rows.filter((r) => r.status !== 'confirmed');
  const queue = await repo.triageQueue();

  return (
    <>
      <PageHeader
        title="Front desk"
        subtitle={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${rows.length} appointment${rows.length === 1 ? '' : 's'} today`}
        action={<WalkInDialog />}
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={`Expected · ${expected.length}`}>
          {expected.length === 0 ? (
            <EmptyState icon="event_available" title="Everyone has arrived" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {expected.map((a) => (
                <li key={a.id} className="rounded-row border border-hairline p-4 flex items-center gap-3 row-hover">
                  <span className="val text-support font-bold w-12 shrink-0">
                    {a.apptTime.slice(0, 5)}
                  </span>
                  <Avatar name={a.patientName ?? '?'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold truncate">{a.patientName}</p>
                    <p className="text-support text-ink-soft truncate">
                      <span className="val">{a.mrn}</span> · {a.apptType} · {a.doctorName}
                    </p>
                  </div>
                  <CheckInButton id={a.id} name={a.patientName ?? a.mrn} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Arrived and in the queue · ${queue.length}`}>
          {arrived.length === 0 ? (
            <EmptyState icon="hourglass_empty" title="Nobody checked in yet" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {arrived.map((a) => (
                <li key={a.id} className="rounded-row border border-hairline p-4 flex items-center gap-3">
                  <span className="val text-support font-bold w-12 shrink-0">
                    {a.apptTime.slice(0, 5)}
                  </span>
                  <Avatar name={a.patientName ?? '?'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold truncate">{a.patientName}</p>
                    <p className="val text-support text-ink-soft">{a.mrn}</p>
                  </div>
                  <StatusChip value={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
