import { notFound } from 'next/navigation';
import { repo } from '@/lib/repository';
import { DocumentShell } from '@/components/document-shell';

export const dynamic = 'force-dynamic';

export default async function PrescriptionSlip({ params }: { params: { id: string } }) {
  const rx = await repo.prescriptionSlip(Number(params.id));
  if (!rx) notFound();

  return (
    <DocumentShell
      title="Prescription"
      reference={`RX-${String(rx.id).padStart(5, '0')}`}
      patient={{
        name: rx.patientName,
        mrn: rx.mrn,
        extra: `${rx.age}${rx.sex}`,
      }}
      footerNote="Dispensed quantities are recorded against pharmacy stock automatically. This slip is a record, not an authorisation to dispense twice."
    >
      {rx.allergies.length > 0 && (
        <p className="rounded-control border border-danger-br bg-danger-bg px-3 py-2 mb-5 text-body text-danger-fg font-display font-bold">
          Allergic to {rx.allergies.join(', ')}
        </p>
      )}

      <table className="w-full text-body">
        <thead>
          <tr>
            <th className="th">Medicine</th>
            <th className="th">Dose</th>
            <th className="th">Frequency</th>
            <th className="th">Duration</th>
            <th className="th text-right">Quantity</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="td font-display font-bold">{rx.drug}</td>
            <td className="td val">{rx.dose}</td>
            <td className="td">{rx.frequency}</td>
            <td className="td">{rx.duration}</td>
            <td className="td val text-right">{rx.quantity}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6">
        <p className="label">Prescriber</p>
        <p className="font-display font-bold">{rx.prescriberName}</p>
        <p className="val text-support text-ink-soft">
          {rx.staffNo}{rx.department ? ` · ${rx.department}` : ''}
        </p>
      </div>
    </DocumentShell>
  );
}
