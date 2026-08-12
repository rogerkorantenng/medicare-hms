'use client';

import { ReasonAction } from '@/components/reason-action';
import { cancelLabAction, rejectSampleAction } from '@/app/actions';
import type { LabOrder } from '@/lib/repository/types';

/**
 * Rejecting a sample and cancelling an order.
 *
 * Rejection is the interesting one. The stage machine is forward-only,
 * and rightly so, but a haemolysed or mislabelled sample genuinely
 * returns the order to 'ordered' so a fresh one can be taken. Without
 * it a technician either verifies a result they do not trust, or leaves
 * the order sitting against a sample that has been thrown away.
 */
export function LabActions({ order }: { order: LabOrder }) {
  const collected = order.status === 'collected' || order.status === 'processing';

  return (
    <div className="flex justify-end gap-1">
      {collected && (
        <ReasonAction
          label="Reject" icon="block" tone="danger"
          title="Reject this sample"
          prompt={`${order.testName} for ${order.patientName ?? order.mrn}. The order returns to ordered so a fresh sample can be taken.`}
          placeholder="Haemolysed, clotted, insufficient or mislabelled"
          confirmLabel="Reject sample"
          perform={(reason) => rejectSampleAction(order.id, reason)}
        />
      )}
      {order.status !== 'verified' && (
        <ReasonAction
          label="Cancel" icon="close"
          title="Cancel this order"
          prompt={`${order.testName}. The order stays on the record with the reason attached.`}
          placeholder="No longer clinically indicated"
          confirmLabel="Cancel order"
          perform={(reason) => cancelLabAction(order.id, reason)}
        />
      )}
    </div>
  );
}
