import { notFound } from 'next/navigation';
import { repo } from '@/lib/repository';
import { DocumentShell } from '@/components/document-shell';
import { onlyDate } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * The discharge summary is written by discharge_patient() at the moment the
 * bed is freed, in the same transaction. This screen renders the stored
 * document rather than reconstructing it, so what is printed is exactly what
 * was recorded.
 */
export default async function DischargeSummary({ params }: { params: { id: string } }) {
  const doc = await repo.dischargeSummary(Number(params.id));
  if (!doc) notFound();

  return (
    <DocumentShell
      title="Discharge summary"
      reference={`DOC-${String(doc.id).padStart(5, '0')}`}
      patient={{
        name: doc.patientName,
        mrn: doc.mrn,
        extra: onlyDate(doc.docDate),
      }}
      footerNote="Written at the moment of discharge, in the same transaction that freed the bed."
    >
      <h2 className="text-section mb-3">{doc.title}</h2>
      <pre className="whitespace-pre-wrap font-body text-body leading-relaxed">
        {doc.body ?? 'No content recorded.'}
      </pre>
    </DocumentShell>
  );
}
