import type { ReactNode } from 'react';
import { PrintButton } from '@/components/print-button';

/**
 * Every printable document carries the hospital header, the patient
 * identifier, the content, a generated-on line and a signature line.
 */
export function DocumentShell({
  title, reference, patient, children, footerNote,
}: {
  title: string;
  reference: string;
  patient: { name: string; mrn: string; extra?: string };
  children: ReactNode;
  footerNote?: string;
}) {
  return (
    <>
      <header className="flex items-start justify-between gap-6 pb-5 border-b-2 border-ink">
        <div>
          <p className="font-display text-2xl font-extrabold">MediCare+</p>
          <p className="text-support text-ink-soft">General Hospital · Accra, Ghana</p>
          <p className="text-support text-ink-soft">+233 (30) 000-0000 · care@medicare.com</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold">{title}</p>
          <p className="val text-support text-ink-soft">{reference}</p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4 py-4 border-b border-hairline">
        <div>
          <p className="label">Patient</p>
          <p className="font-display font-bold">{patient.name}</p>
        </div>
        <div>
          <p className="label">Medical record no.</p>
          <p className="val font-bold">{patient.mrn}</p>
        </div>
        {patient.extra && (
          <div>
            <p className="label">Detail</p>
            <p className="val">{patient.extra}</p>
          </div>
        )}
      </section>

      <main className="py-6">{children}</main>

      <footer className="pt-6 border-t border-hairline">
        <div className="flex justify-between items-end gap-8">
          <p className="val text-support text-ink-soft">
            Generated {new Date().toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
          <div className="text-center">
            <div className="w-56 border-b border-ink mb-1.5" />
            <p className="text-support text-ink-soft">Signature and stamp</p>
          </div>
        </div>
        {footerNote && <p className="text-support text-ink-faint mt-4">{footerNote}</p>}
      </footer>

      <div className="mt-8 flex justify-end no-print">
        <PrintButton />
      </div>
    </>
  );
}
