import { repo } from '@/lib/repository';
import { PageHeader, Card, Stat, money } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * The numbers an administrator is otherwise asked for verbally.
 *
 * The no-show rate is the one worth having: it was impossible to know
 * before, because nothing could record that somebody had not turned up.
 */
export default async function Reports({
  searchParams,
}: { searchParams: { days?: string } }) {
  const days = Math.min(Math.max(Number(searchParams.days) || 30, 1), 90);
  const s = await repo.summary(days);
  const attended = s.appointments - s.didNotAttend - s.cancelled;
  const rate = s.appointments ? Math.round((s.didNotAttend / s.appointments) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Activity and money over the last ${days} days.`}
        action={
          <a className="btn-secondary" href="/api/reports/audit.csv" download>
            Download the audit trail
          </a>
        }
      />

      <nav className="flex gap-2 mb-6" aria-label="Reporting period">
        {[7, 30, 90].map((n) => (
          <a key={n} href={`/workspace/admin/reports?days=${n}`}
             className={`btn ${n === days ? 'btn-primary' : 'btn-secondary'}`}>
            {n} days
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Appointments" icon="event" value={s.appointments} />
        <Stat label="Attended" icon="how_to_reg" value={attended} tone="success" />
        <Stat label="Did not attend" icon="person" value={s.didNotAttend}
              tone={s.didNotAttend ? 'warning' : undefined} hint={`${rate}% of bookings`} />
        <Stat label="Cancelled" icon="close" value={s.cancelled} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Consultations" icon="stethoscope" value={s.consultations} />
        <Stat label="Collected" icon="payments" value={money(s.collected)} tone="success" />
        <Stat label="Refunded" icon="schedule" value={money(s.refunded)}
              tone={s.refunded ? 'warning' : undefined} />
        <Stat label="Written off" icon="block" value={money(s.writtenOff)}
              tone={s.writtenOff ? 'danger' : undefined} />
      </div>

      <Card title="How to read this">
        <ul className="flex flex-col gap-2 text-support text-ink-soft">
          <li>
            <b className="text-ink">Did not attend</b> counts slots that were held and
            wasted. It is kept apart from cancellations, because a cancellation
            releases the slot and a no-show does not.
          </li>
          <li>
            <b className="text-ink">Collected</b> is money actually taken, net of nothing.
            Refunds are listed separately so a busy day of corrections cannot
            quietly flatter the total.
          </li>
          <li>
            <b className="text-ink">Written off</b> is a balance the hospital has decided
            not to pursue. It closes an invoice without any money arriving, which
            is why it is never counted as revenue.
          </li>
        </ul>
      </Card>
    </>
  );
}
