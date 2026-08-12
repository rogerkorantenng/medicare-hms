'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import { advanceImagingAction } from '@/app/actions';
import type { ImagingOrder } from '@/lib/repository/types';

/**
 * Scan tracking.
 *
 * imaging_status has four states and the code went straight from the
 * first to the last, so 'scheduled' and 'scanned' were unreachable and
 * the department had no way to say where a patient actually was. The
 * submitted documents describe scan tracking; this is it.
 */
export function ScanSteps({ order }: { order: ImagingOrder }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const next = order.status === 'ordered' ? 'scheduled'
    : order.status === 'scheduled' ? 'scanned' : null;

  if (!next) return null;

  async function advance() {
    setBusy(true);
    const result = await advanceImagingAction(order.id, next!);
    setBusy(false);
    toast(result.message, result.ok ? 'ok' : 'error');
    if (result.ok) router.refresh();
  }

  return (
    <button className="btn-secondary" onClick={advance} disabled={busy}>
      <Icon name={next === 'scheduled' ? 'event' : 'colorize'} size={16} />
      Mark {next}
    </button>
  );
}
