'use client';

import { Icon } from '@/components/ui';

export function PrintButton() {
  return (
    <button type="button" className="btn-primary no-print" onClick={() => window.print()}>
      <Icon name="print" size={17} />Print
    </button>
  );
}
