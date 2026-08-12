import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/supabase/server';
import { PageHeader, Avatar, Chip, RestrictionNotice } from '@/components/ui';
import { ChartTabs } from './chart-tabs';
import { ROLE_LABEL } from '@/lib/nav';

export const dynamic = 'force-dynamic';

/**
 * Six tabs: Timeline, Vitals, Results, Medications, Billing, Documents.
 *
 * For a receptionist or a cashier the clinical arrays come back empty — not
 * because this screen hides them, but because row-level security never sent
 * them. The notice explains why the tabs are bare.
 */
export default async function PatientChart({ params }: { params: { mrn: string } }) {
  const [chart, me] = await Promise.all([repo.getPatientChart(params.mrn), currentUser()]);
  const clinical = ['doctor', 'nurse', 'lab', 'radiology', 'pharmacist', 'admin'].includes(me!.role);
  const p = chart.patient;

  return (
    <>
      <PageHeader
        title={p.fullName}
        subtitle={`${p.mrn} · ${p.age}${p.sex} · ${p.phone}${p.insurance ? ` · ${p.insurance}` : ''}`}
      />

      <div className="card p-5 mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={p.fullName} size={52} />
        <div className="flex flex-wrap gap-1.5 flex-1">
          {p.bloodGroup && <Chip tone="neutral" icon="water_drop">{p.bloodGroup}</Chip>}
          {p.allergies.length === 0
            ? <Chip tone="success">No known allergies</Chip>
            : p.allergies.map((a) => <Chip key={a} tone="danger" icon="warning">Allergic to {a}</Chip>)}
          {p.conditions.map((c) => <Chip key={c} tone="info">{c}</Chip>)}
          {chart.bed && <Chip tone="warning" icon="bed">{chart.bed.ward} · {chart.bed.bedNo}</Chip>}
        </div>
      </div>

      {!clinical && (
        <div className="mb-5">
          <RestrictionNotice role={ROLE_LABEL[me!.role]} />
        </div>
      )}

      <ChartTabs chart={chart} clinical={clinical} />
    </>
  );
}
