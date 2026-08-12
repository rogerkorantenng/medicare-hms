import { repo } from '@/lib/repository';
import { PageHeader, Card, Stat, money } from '@/components/ui';
import { OpsCopilot } from './ops-copilot';
import { LiveActivity } from './live-activity';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [kpis, wards, activity] = await Promise.all([
    repo.dashboardKpis(),
    repo.wardBoard(),
    repo.liveActivity(12),
  ]);

  return (
    <>
      <PageHeader title="Hospital overview" subtitle="Live figures, straight from the database." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Patients registered" icon="groups" value={kpis.patientsTotal} />
        <Stat label="Appointments today" icon="event" value={kpis.appointmentsToday} />
        <Stat label="Revenue collected" icon="payments" value={money(kpis.revenueCollected)} tone="success" />
        <Stat label="Outstanding" icon="schedule" value={money(kpis.revenueOutstanding)}
              tone={kpis.revenueOutstanding > 0 ? 'warning' : undefined} />
        <Stat label="Beds occupied" icon="bed" value={`${kpis.bedsOccupied} / ${kpis.bedsTotal}`} />
        <Stat label="Waiting in queue" icon="hourglass_empty" value={kpis.queueWaiting} />
        <Stat label="Laboratory pending" icon="science" value={kpis.labsPending} />
        <Stat label="Prescriptions pending" icon="pill" value={kpis.rxPending} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-5 mt-6">
        <div className="flex flex-col gap-5">
          <OpsCopilot />

          <Card title="Department load">
            <ul className="flex flex-col gap-3">
              {wards.map((w) => {
                const pct = w.total ? Math.round((w.occupied / w.total) * 100) : 0;
                return (
                  <li key={w.name}>
                    <div className="flex justify-between text-support mb-1">
                      <span className="font-display font-semibold">{w.name}</span>
                      <span className="val text-ink-soft">{w.occupied} / {w.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-wash overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 80 ? 'bg-danger-fg' : pct >= 50 ? 'bg-warning-fg' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <LiveActivity initial={activity} />
      </div>
    </>
  );
}
