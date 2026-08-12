'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { advanceLabAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon } from '@/components/ui';
import type { LabOrder, LabStatus, ResultFlag } from '@/lib/repository/types';

/** Stages advance one at a time, so only the next legal one is offered. */
const NEXT: Record<string, { status: LabStatus; label: string; icon: string } | null> = {
  ordered:    { status: 'collected',  label: 'Collect sample', icon: 'colorize' },
  collected:  { status: 'processing', label: 'Start processing', icon: 'science' },
  processing: { status: 'resulted',   label: 'Enter result', icon: 'edit_note' },
  resulted:   { status: 'verified',   label: 'Verify and release', icon: 'verified' },
  verified:   null,
};

export function LabRow({ order }: { order: LabOrder }) {
  const next = NEXT[order.status];
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(order.resultValue ?? '');
  const [flag, setFlag] = useState<ResultFlag>(order.flag ?? 'normal');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  if (!next) return <span className="text-support text-ink-faint">Released</span>;

  function advance(result?: { resultValue: string; refRange?: string | null; flag?: ResultFlag }) {
    start(async () => {
      const r = await advanceLabAction(order.id, next!.status, result);
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) { setOpen(false); router.refresh(); }
    });
  }

  // Entering a result needs a value; verifying needs one to already exist.
  if (next.status === 'resulted') {
    return (
      <>
        <button className="btn-secondary ml-auto" onClick={() => setOpen(true)}>
          <Icon name={next.icon} size={16} />{next.label}
        </button>

        {open && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/50 p-4" onClick={() => setOpen(false)}>
            <div className="panel w-full max-w-md p-6 animate-fadeUp text-left" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-section">Enter result</h3>
              <p className="text-support text-ink-soft mt-1">
                {order.testName} for {order.patientName}
              </p>

              <div className="mt-4 rounded-control bg-primary-wash border border-hairline px-3 py-2">
                <p className="label">Reference range</p>
                <p className="val text-body mt-0.5">{order.refRange ?? 'Not stated'}</p>
              </div>

              <div className="field mt-4">
                <label htmlFor="value">Result value</label>
                <input id="value" value={value} autoFocus
                       onChange={(e) => setValue(e.target.value)}
                       placeholder="e.g. LDL 128 mg/dL" className="val" />
              </div>

              <div className="field mt-4">
                <label htmlFor="flag">Flag</label>
                <select id="flag" value={flag} onChange={(e) => setFlag(e.target.value as ResultFlag)}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                  <option value="critical">Critical — escalates to the ordering doctor</option>
                </select>
              </div>

              <p className="text-support text-ink-soft mt-4">
                Entering a result does not release it. It reaches the doctor and the
                patient only when it is verified.
              </p>

              <div className="flex gap-2 mt-5">
                <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>Cancel</button>
                <button
                  className="btn-primary flex-1"
                  disabled={!value.trim() || pending}
                  onClick={() => advance({ resultValue: value.trim(), refRange: order.refRange, flag })}
                >
                  {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="save" size={16} />}
                  Save result
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button
      className={`ml-auto ${next.status === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
      disabled={pending}
      onClick={() => advance()}
    >
      {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name={next.icon} size={16} />}
      {next.label}
    </button>
  );
}
