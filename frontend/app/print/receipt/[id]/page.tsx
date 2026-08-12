import { notFound } from 'next/navigation';
import { repo } from '@/lib/repository';
import { DocumentShell } from '@/components/document-shell';
import { money } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Receipt({ params }: { params: { id: string } }) {
  const invoice = await repo.receipt(params.id);
  if (!invoice) notFound();

  const total = invoice.total;
  const paid = invoice.paid;
  const balance = Math.max(0, total - paid);

  return (
    <DocumentShell
      title="Receipt"
      reference={invoice.id}
      patient={{ name: invoice.patientName, mrn: invoice.mrn }}
      footerNote="Invoice status is derived from the total and the amount paid, so it cannot disagree with the figures above."
    >
      <table className="w-full text-body">
        <thead>
          <tr>
            <th className="th">Description</th>
            <th className="th text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id}>
              <td className="td">{l.description}</td>
              <td className="td val text-right">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto w-64 flex flex-col gap-1.5">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Total</dt>
          <dd className="val">{money(total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Paid</dt>
          <dd className="val">{money(paid)}</dd>
        </div>
        <div className="flex justify-between pt-2 border-t border-ink font-bold">
          <dt>Balance</dt>
          <dd className="val">{money(balance)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-right">
        <span className={balance === 0 ? 'chip-success' : paid > 0 ? 'chip-warning' : 'chip-danger'}>
          {balance === 0 ? 'Paid in full' : paid > 0 ? 'Part paid' : 'Unpaid'}
        </span>
      </p>
    </DocumentShell>
  );
}
