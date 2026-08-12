import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, Chip, when } from '@/components/ui';
import { AdministerButton } from './administer-button';

export const dynamic = 'force-dynamic';

/** Inpatients with due drugs. Ticking records the nurse's name and the time. */
export default async function MedicationRecord() {
  const entries = await repo.medicationRound();
  const due = entries.filter((e) => e.dueNow);

  return (
    <>
      <PageHeader
        title="Medication record"
        subtitle="Inpatients with active prescriptions. Recording an administration writes your name and the time to the audit trail."
      />

      <Card
        title={`${entries.length} active on the ward`}
        action={due.length > 0 ? <Chip tone="warning" icon="schedule">{due.length} due now</Chip> : undefined}
      >
        {entries.length === 0 ? (
          <EmptyState icon="medication" title="No inpatient medication" hint="No admitted patient has an active prescription." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[820px] text-body">
              <thead>
                <tr>
                  <th className="th pl-5">Patient</th>
                  <th className="th">Bed</th>
                  <th className="th">Drug</th>
                  <th className="th">Dose and frequency</th>
                  <th className="th">Last given</th>
                  <th className="th pr-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.prescriptionId} className="row-hover">
                    <td className="td pl-5">
                      <p className="font-display font-semibold">{e.patientName}</p>
                      <p className="val text-chip text-ink-soft">{e.mrn}</p>
                    </td>
                    <td className="td val">{e.ward} {e.bedNo}</td>
                    <td className="td font-display font-semibold">{e.drug}</td>
                    <td className="td text-ink-soft">{e.dose} · {e.frequency}</td>
                    <td className="td">
                      {e.lastGivenAt
                        ? <span className="val text-support">{when(e.lastGivenAt)}</span>
                        : <Chip tone="neutral">Not yet given</Chip>}
                    </td>
                    <td className="td pr-5 text-right">
                      <AdministerButton id={e.prescriptionId} drug={e.drug} due={e.dueNow} />
                    </td>
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
