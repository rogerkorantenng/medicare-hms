import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { DocumentShell } from '@/components/document-shell';

export const dynamic = 'force-dynamic';

export default async function PrescriptionSlip({ params }: { params: { id: string } }) {
  const { data } = await supabaseServer()
    .from('prescriptions')
    .select('*, patients(full_name, age, sex, allergies), staff:prescriber_id(full_name, staff_no, department)')
    .eq('id', Number(params.id))
    .maybeSingle();

  if (!data) notFound();

  return (
    <DocumentShell
      title="Prescription"
      reference={`RX-${String(data.id).padStart(5, '0')}`}
      patient={{
        name: data.patients?.full_name ?? '—',
        mrn: data.mrn,
        extra: `${data.patients?.age ?? ''}${data.patients?.sex ?? ''}`,
      }}
      footerNote="Dispensed quantities are recorded against pharmacy stock automatically. This slip is a record, not an authorisation to dispense twice."
    >
      {!!data.patients?.allergies?.length && (
        <p className="rounded-control border border-danger-br bg-danger-bg px-3 py-2 mb-5 text-body text-danger-fg font-display font-bold">
          Allergic to {data.patients.allergies.join(', ')}
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
            <td className="td font-display font-bold">{data.drug}</td>
            <td className="td val">{data.dose}</td>
            <td className="td">{data.frequency}</td>
            <td className="td">{data.duration}</td>
            <td className="td val text-right">{data.quantity}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6">
        <p className="label">Prescriber</p>
        <p className="font-display font-bold">{data.staff?.full_name}</p>
        <p className="val text-support text-ink-soft">
          {data.staff?.staff_no}{data.staff?.department ? ` · ${data.staff.department}` : ''}
        </p>
      </div>
    </DocumentShell>
  );
}
