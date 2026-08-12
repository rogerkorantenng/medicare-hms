import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, StatusChip, Chip, Icon, when } from '@/components/ui';
import { LabRow } from './lab-row';

export const dynamic = 'force-dynamic';

/**
 * Sample worklist. STAT first and marked. Four stages: collect, process,
 * enter result, verify — and only the next one is ever offered, so the
 * trigger's refusal cannot be reached in normal use.
 */
export default async function LabWorklist() {
  const orders = await repo.labWorklist();
  const stat = orders.filter((o) => o.priority === 'stat');

  return (
    <>
      <PageHeader
        title="Sample worklist"
        subtitle="STAT samples sort first. Verification is the release point — nothing reaches the doctor or the patient before it."
      />

      {stat.length > 0 && (
        <div className="mb-5 rounded-card border border-danger-br bg-danger-bg px-4 py-3 flex items-center gap-2.5">
          <Icon name="priority_high" className="text-danger-fg" size={20} filled />
          <p className="text-body text-danger-fg font-display font-bold">
            {stat.length} STAT sample{stat.length > 1 ? 's' : ''} waiting
          </p>
        </div>
      )}

      <Card title={`${orders.length} open order${orders.length === 1 ? '' : 's'}`}>
        {orders.length === 0 ? (
          <EmptyState icon="science" title="Nothing waiting" hint="Every sample has been verified and released." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[900px] text-body">
              <thead>
                <tr>
                  <th className="th pl-5">Patient</th>
                  <th className="th">Test</th>
                  <th className="th">Priority</th>
                  <th className="th">Stage</th>
                  <th className="th">Ordered</th>
                  <th className="th pr-5 text-right">Next action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="row-hover">
                    <td className="td pl-5">
                      <p className="font-display font-semibold">{o.patientName ?? '—'}</p>
                      <p className="val text-chip text-ink-soft">{o.mrn}</p>
                    </td>
                    <td className="td">{o.testName}</td>
                    <td className="td">
                      {o.priority === 'stat'
                        ? <Chip tone="danger" icon="priority_high">STAT</Chip>
                        : <Chip tone="neutral">Routine</Chip>}
                    </td>
                    <td className="td"><StatusChip value={o.status} /></td>
                    <td className="td val text-support text-ink-soft">{when(o.createdAt)}</td>
                    <td className="td pr-5"><LabRow order={o} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
