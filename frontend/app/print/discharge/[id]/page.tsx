import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
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
  const { data } = await supabaseServer()
    .from('documents')
    .select('*, patients(full_name, age, sex)')
    .eq('id', Number(params.id))
    .maybeSingle();

  if (!data) notFound();

  return (
    <DocumentShell
      title="Discharge summary"
      reference={`DOC-${String(data.id).padStart(5, '0')}`}
      patient={{
        name: data.patients?.full_name ?? '—',
        mrn: data.mrn,
        extra: onlyDate(data.doc_date),
      }}
      footerNote="Written at the moment of discharge, in the same transaction that freed the bed."
    >
      <h2 className="text-section mb-3">{data.title}</h2>
      <pre className="whitespace-pre-wrap font-body text-body leading-relaxed">
        {data.body ?? 'No content recorded.'}
      </pre>
    </DocumentShell>
  );
}
