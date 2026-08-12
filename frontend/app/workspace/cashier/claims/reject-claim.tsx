'use client';

import { ReasonAction } from '@/components/reason-action';
import { rejectClaimAction } from '@/app/actions';
import type { Claim } from '@/lib/repository/types';

/**
 * Insurers refuse claims, and the status only ever moved forward:
 * submitted, authorised, paid. There was no way to record the answer a
 * hospital actually receives most often.
 */
export function RejectClaim({ claim }: { claim: Claim }) {
  if (claim.status === 'paid') return null;

  return (
    <ReasonAction
      label="Rejected" icon="block" tone="danger"
      title={`Record a rejection for ${claim.id}`}
      prompt={`${claim.insurer} has refused this claim. It keeps its place in the ledger with the reason attached.`}
      placeholder="Missing referral, or outside cover"
      confirmLabel="Record rejection"
      perform={(reason) => rejectClaimAction(claim.id, reason)}
    />
  );
}
