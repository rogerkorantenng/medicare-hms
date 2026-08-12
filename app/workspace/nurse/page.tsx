import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, Avatar, Chip } from '@/components/ui';
import { VitalsDialog } from './vitals-dialog';

export const dynamic = 'force-dynamic';

/** Patients checked in, ordered by arrival, with a record-vitals action. */
export default async function TriageQueue() {
  const queue = await repo.triageQueue();
  const waiting = queue.filter((q) => q.stage === 'waiting');
  const ready = queue.filter((q) => q.stage !== 'waiting');

  return (
    <>
      <PageHeader
        title="Triage queue"
        subtitle="Ordered by arrival. Recording vitals moves a patient on to the doctor."
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={`Waiting for triage · ${waiting.length}`}>
          {waiting.length === 0 ? (
            <EmptyState icon="done_all" title="Queue is clear" hint="Everyone checked in has been triaged." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {waiting.map((q) => (
                <li key={q.mrn} className="rounded-row border border-hairline p-4 flex items-center gap-3">
                  <Avatar name={q.patientName} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold truncate">{q.patientName}</p>
                    <p className="text-support text-ink-soft">
                      <span className="val">{q.mrn}</span> · {q.age}{q.sex} · {q.reason}
                    </p>
                  </div>
                  <span className="val text-support text-ink-soft">{q.waitingSince}</span>
                  <VitalsDialog mrn={q.mrn} name={q.patientName} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Triaged, waiting for a doctor · ${ready.length}`}>
          {ready.length === 0 ? (
            <EmptyState icon="hourglass_empty" title="Nobody triaged yet" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ready.map((q) => (
                <li key={q.mrn} className="rounded-row border border-hairline p-4 flex items-center gap-3">
                  <Avatar name={q.patientName} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold truncate">{q.patientName}</p>
                    <p className="text-support text-ink-soft">
                      {q.vitals && (
                        <span className="val">
                          {q.vitals.systolic}/{q.vitals.diastolic} mmHg · {q.vitals.pulse} bpm · {q.vitals.temperature} °C
                        </span>
                      )}
                    </p>
                  </div>
                  {q.acuity && (
                    <Chip tone={q.acuity === 'urgent' ? 'danger' : q.acuity === 'semi_urgent' ? 'warning' : 'neutral'}>
                      {q.acuity === 'semi_urgent' ? 'Semi-urgent' : q.acuity === 'urgent' ? 'Urgent' : 'Routine'}
                    </Chip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
