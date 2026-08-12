'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reportImagingAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import type { ImagingOrder } from '@/lib/repository/types';

export function ReportForm({ order }: { order: ImagingOrder }) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState(order.findings ?? '');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Icon name="description" size={16} />File report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4" onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-lg p-6 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-section">Report — {order.modality}{order.bodyRegion ? ` ${order.bodyRegion}` : ''}</h3>
            <p className="text-support text-ink-soft mt-1">
              {order.patientName} · <span className="val">{order.mrn}</span>
            </p>

            <div className="field mt-4">
              <label htmlFor="findings">Findings</label>
              <textarea
                id="findings" rows={7} autoFocus value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Technique, findings, impression."
              />
            </div>

            <div className="flex gap-2 mt-5">
              <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>Cancel</button>
              <button
                className="btn-primary flex-1"
                disabled={!findings.trim() || pending}
                onClick={() =>
                  start(async () => {
                    const r = await reportImagingAction(order.id, findings.trim());
                    toast(r.message, r.ok ? 'ok' : 'error');
                    if (r.ok) { setOpen(false); router.refresh(); }
                  })
                }
              >
                {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="check" size={16} />}
                File report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
