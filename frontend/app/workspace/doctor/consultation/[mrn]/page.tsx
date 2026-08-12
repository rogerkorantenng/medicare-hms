import { repo } from '@/lib/repository';
import { PageHeader } from '@/components/ui';
import { ConsultationWorkspace } from './workspace';

export const dynamic = 'force-dynamic';

/**
 * Left: history, allergies, conditions, latest vitals.
 * Centre: complaint, diagnosis, notes, Draft with AI.
 * Right: staged order panel.
 *
 * Nothing dispatches until the consultation is signed, and signing is one
 * transaction — all of it commits or none of it does.
 */
export default async function Consultation({ params }: { params: { mrn: string } }) {
  const [chart, wards] = await Promise.all([
    repo.getPatientChart(params.mrn),
    repo.wardBoard(),
  ]);

  return (
    <>
      <PageHeader
        title={chart.patient.fullName}
        subtitle={`${chart.patient.mrn} · ${chart.patient.age}${chart.patient.sex} · ${chart.patient.bloodGroup ?? 'blood group not recorded'}`}
      />
      <ConsultationWorkspace chart={chart} wards={wards} />
    </>
  );
}
