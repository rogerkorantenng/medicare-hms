import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, StatusChip, Stat, money, onlyDate } from '@/components/ui';
import { InvoiceActions } from './invoice-actions';

export const dynamic = 'force-dynamic';

/**
 * Invoices with their lines, total, paid and derived status.
 *
 * Status is a generated column in the database — it is computed from total
 * and paid, so it cannot disagree with them after a partial payment.
 */
export default async function Invoices() {
  const invoices = await repo.invoices();
  const collected = invoices.reduce((s, i) => s + i.paid, 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);

  return (
    <>
      <PageHeader title="Invoices" subtitle="Status is derived from the total and what has been paid, so the two can never disagree." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Collected" icon="payments" value={money(collected)} tone="success" />
        <Stat label="Outstanding" icon="schedule" value={money(outstanding)} tone={outstanding ? 'warning' : undefined} />
        <Stat label="Invoices" icon="receipt_long" value={invoices.length} />
        <Stat label="Unpaid" icon="priority_high" value={invoices.filter((i) => i.status === 'unpaid').length} />
      </div>

      {invoices.length === 0 ? (
        <Card><EmptyState icon="receipt_long" title="No invoices yet" /></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="val text-card">{inv.id}</h3>
                    <StatusChip value={inv.status} />
                  </div>
                  <p className="text-support text-ink-soft mt-1">
                    {inv.patientName} · <span className="val">{inv.mrn}</span> · raised {onlyDate(inv.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="label">Balance</p>
                  <p className="val text-xl font-bold">{money(Math.max(0, inv.total - inv.paid))}</p>
                  <p className="val text-support text-ink-soft">
                    {money(inv.paid)} paid of {money(inv.total)}
                  </p>
                </div>
              </div>

              <ul className="mt-4 border-t border-hairline">
                {inv.lines.map((l) => (
                  <li key={l.id} className="flex justify-between py-2 border-b border-hairline text-body">
                    <span>{l.description}</span>
                    <span className="val">{money(l.amount)}</span>
                  </li>
                ))}
              </ul>

              <InvoiceActions invoice={inv} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
