import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, StatusChip, Chip, when } from '@/components/ui';
import { ReportForm } from './report-form';
import { ScanSteps } from './scan-steps';

export const dynamic = 'force-dynamic';

/** Grouped by modality, with priority flags. */
export default async function ImagingWorklist() {
  const orders = await repo.imagingWorklist();

  const byModality = new Map<string, typeof orders>();
  for (const o of orders) byModality.set(o.modality, [...(byModality.get(o.modality) ?? []), o]);

  return (
    <>
      <PageHeader
        title="Imaging worklist"
        subtitle="Filing a report attaches it to the chart and lists it under documents."
      />

      {orders.length === 0 && (
        <Card><EmptyState icon="radiology" title="Nothing waiting" hint="Every study has been reported." /></Card>
      )}

      <div className="flex flex-col gap-5">
        {[...byModality.entries()].map(([modality, list]) => (
          <Card key={modality} title={`${modality} · ${list.length}`}>
            <ul className="flex flex-col gap-2.5">
              {list.map((o) => (
                <li key={o.id} className="rounded-row border border-hairline p-4 flex flex-wrap items-center gap-4">
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-display font-bold">
                      {o.modality}{o.bodyRegion ? ` · ${o.bodyRegion}` : ''}
                    </p>
                    <p className="text-support text-ink-soft mt-0.5">
                      {o.patientName ?? '—'} <span className="val">{o.mrn}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.priority === 'stat'
                      ? <Chip tone="danger" icon="priority_high">STAT</Chip>
                      : <Chip tone="neutral">Routine</Chip>}
                    <StatusChip value={o.status} />
                  </div>
                  <p className="val text-support text-ink-soft">{when(o.createdAt)}</p>
                  <div className="ml-auto flex items-center gap-2">
                    <ScanSteps order={o} />
                    <ReportForm order={o} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
