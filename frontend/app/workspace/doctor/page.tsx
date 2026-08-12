import Link from 'next/link';
import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/session';
import { PageHeader, Card, Stat, EmptyState, Avatar, Chip, Icon, when } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Doctor dashboard. KPI row, critical-result banner at the top when one
 * exists, patient queue with acuity.
 *
 * The banner reads verified critical results only — the database will not
 * release anything before a technician verifies it, so an unverified critical
 * value cannot appear here.
 */
export default async function DoctorDashboard() {
  const me = await currentUser();
  const [queue, notifications, labs] = await Promise.all([
    repo.doctorQueue(me!.id),
    repo.notifications(),
    repo.labWorklist(),
  ]);

  const criticals = notifications.filter((n) => n.kind === 'critical' && !n.isRead);
  const pendingMine = labs.filter((l) => l.orderedBy === me!.id);

  return (
    <>
      <PageHeader
        title={`Good day, ${me!.fullName.replace(/^Dr\.?\s*/i, 'Dr ')}`}
        subtitle="Your queue and the work you have outstanding."
      />

      {/* Critical results come first, above everything. */}
      {criticals.length > 0 && (
        <div className="mb-6 rounded-card border-2 border-danger-br bg-danger-bg p-4 animate-fadeUp">
          <p className="flex items-center gap-2 font-display font-extrabold text-danger-fg">
            <Icon name="e911_emergency" size={22} filled className="animate-breathe" />
            {criticals.length} critical result{criticals.length > 1 ? 's' : ''} need your attention
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {criticals.map((n) => (
              <li key={n.id} className="text-body text-danger-fg">
                <span className="font-semibold">{n.title}</span>
                {n.body && <span className="val text-support"> — {n.body}</span>}
                <span className="text-support text-danger-fg/70"> · {when(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Waiting for you" icon="hourglass_empty" value={queue.length} />
        <Stat label="Urgent in queue" icon="priority_high" value={queue.filter((q) => q.acuity === 'urgent').length}
              tone={queue.some((q) => q.acuity === 'urgent') ? 'danger' : undefined} />
        <Stat label="Your open lab orders" icon="science" value={pendingMine.length} />
        <Stat label="Critical unread" icon="error" value={criticals.length} tone={criticals.length ? 'danger' : undefined} />
      </div>

      <Card title={`Patient queue · ${queue.length}`}>
        {queue.length === 0 ? (
          <EmptyState icon="check_circle" title="Your queue is clear"
                      hint="Patients appear here once reception checks them in and a nurse records vitals." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {queue.map((q) => (
              <li key={q.mrn} className="rounded-row border border-hairline p-4 flex flex-wrap items-center gap-3 row-hover">
                <Avatar name={q.patientName} />
                <div className="min-w-[10rem] flex-1">
                  <p className="font-display font-bold">{q.patientName}</p>
                  <p className="text-support text-ink-soft">
                    <span className="val">{q.mrn}</span> · {q.age}{q.sex} · {q.reason}
                  </p>
                </div>

                {q.vitals && (
                  <p className="val text-support text-ink-soft min-w-[13rem]">
                    {q.vitals.systolic}/{q.vitals.diastolic} mmHg · {q.vitals.pulse} bpm · {q.vitals.temperature} °C
                  </p>
                )}

                {q.acuity ? (
                  <Chip tone={q.acuity === 'urgent' ? 'danger' : q.acuity === 'semi_urgent' ? 'warning' : 'neutral'}>
                    {q.acuity === 'semi_urgent' ? 'Semi-urgent' : q.acuity === 'urgent' ? 'Urgent' : 'Routine'}
                  </Chip>
                ) : (
                  <Chip tone="neutral" icon="hourglass_empty">Awaiting triage</Chip>
                )}

                <Link href={`/workspace/doctor/consultation/${q.mrn}`} className="btn-primary ml-auto">
                  <Icon name="stethoscope" size={16} />Start consultation
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
