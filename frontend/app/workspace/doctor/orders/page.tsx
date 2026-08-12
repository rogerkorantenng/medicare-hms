import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/session';
import { PageHeader, Card, EmptyState, StatusChip, Chip, when } from '@/components/ui';
import { ExplainResult } from '@/components/explain-result';

export const dynamic = 'force-dynamic';

/** Orders this doctor placed, with status. */
export default async function MyOrders() {
  const me = await currentUser();
  const [labs, imaging] = await Promise.all([repo.labWorklist(), repo.imagingWorklist()]);

  const mineLabs = labs.filter((l) => l.orderedBy === me!.id);
  const mineImaging = imaging.filter((i) => i.orderedBy === me!.id);

  return (
    <>
      <PageHeader title="My orders" subtitle="Everything you have ordered that is still in progress." />

      <div className="flex flex-col gap-5">
        <Card title={`Laboratory · ${mineLabs.length}`}>
          {mineLabs.length === 0 ? (
            <EmptyState icon="science" title="No open laboratory orders" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {mineLabs.map((l) => (
                <li key={l.id} className="rounded-row border border-hairline p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-display font-bold">{l.testName}</p>
                    <p className="text-support text-ink-soft">
                      {l.patientName} · <span className="val">{l.mrn}</span>
                    </p>
                  </div>
                  {l.priority === 'stat' && <Chip tone="danger" icon="priority_high">STAT</Chip>}
                  <StatusChip value={l.status} />
                  {l.resultValue && <span className="val text-support">{l.resultValue}</span>}
                  <span className="val text-support text-ink-soft ml-auto">{when(l.createdAt)}</span>
                  {l.status === 'verified' && l.resultValue && (
                    <ExplainResult
                      endpoint="/api/ai/explain-result"
                      body={{ testName: l.testName, resultValue: l.resultValue, refRange: l.refRange, flag: l.flag }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Imaging · ${mineImaging.length}`}>
          {mineImaging.length === 0 ? (
            <EmptyState icon="radiology" title="No open imaging orders" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {mineImaging.map((i) => (
                <li key={i.id} className="rounded-row border border-hairline p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-display font-bold">{i.modality} · {i.bodyRegion}</p>
                    <p className="text-support text-ink-soft">
                      {i.patientName} · <span className="val">{i.mrn}</span>
                    </p>
                  </div>
                  {i.priority === 'stat' && <Chip tone="danger" icon="priority_high">STAT</Chip>}
                  <StatusChip value={i.status} />
                  <span className="val text-support text-ink-soft ml-auto">{when(i.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
