import type { ReactNode } from 'react';

/**
 * Printable documents: prescription slip, receipt, discharge summary.
 * Printed through the browser pipeline on A4 or Letter, so no PDF library
 * is involved. 794px is A4 width at 96dpi.
 */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-[794px] mx-auto bg-white rounded-card border border-hairline shadow-card p-10 print-sheet">
        {children}
      </div>
    </div>
  );
}
