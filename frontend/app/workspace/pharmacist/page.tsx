import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, when } from '@/components/ui';
import { DispenseButton } from './dispense-button';

export const dynamic = 'force-dynamic';

/** Pending queue with drug, dose, frequency, duration, prescriber. */
export default async function Prescriptions() {
  const list = await repo.pendingPrescriptions();

  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle="Dispensing decrements stock automatically. There is no manual adjustment, and an over-dispense fails rather than taking stock negative."
      />

      <Card title={`${list.length} pending`}>
        {list.length === 0 ? (
          <EmptyState icon="pill" title="Nothing to dispense" hint="Every prescription has been dispensed." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.map((rx) => (
              <li key={rx.id} className="rounded-row border border-hairline p-4 flex flex-wrap items-center gap-4 row-hover">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-display font-bold">{rx.drug}</p>
                  <p className="text-support text-ink-soft mt-0.5">
                    {rx.dose} · {rx.frequency} · {rx.duration}
                  </p>
                </div>
                <div className="min-w-[10rem]">
                  <p className="label">Patient</p>
                  <p className="text-body">{rx.patientName ?? '—'}</p>
                  <p className="val text-chip text-ink-soft">{rx.mrn}</p>
                </div>
                <div className="min-w-[9rem]">
                  <p className="label">Quantity</p>
                  <p className="val text-body">{rx.quantity}</p>
                </div>
                <div className="min-w-[10rem]">
                  <p className="label">Prescriber</p>
                  <p className="text-body">{rx.prescriberName ?? '—'}</p>
                  <p className="val text-chip text-ink-soft">{when(rx.createdAt)}</p>
                </div>
                <div className="flex gap-2 ml-auto">
                  <a
                    href={`/print/prescription/${rx.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                  >
                    Print slip
                  </a>
                  <DispenseButton id={rx.id} drug={rx.drug} quantity={rx.quantity} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
