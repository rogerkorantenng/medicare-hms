'use client';

import { ReasonAction } from '@/components/reason-action';
import { reprioritiseAction } from '@/app/actions';
import type { Acuity } from '@/lib/repository/types';

/**
 * Moving somebody up the queue.
 *
 * A patient who deteriorates in the waiting room could not be
 * re-prioritised: the acuity was set once at triage and never again. The
 * reason is required because moving one person up moves everybody else
 * down, and the next nurse deserves to know why.
 */
export function Retriage({ mrn, name, acuity }: {
  mrn: string; name: string; acuity: Acuity | null;
}) {
  const next: Acuity = acuity === 'urgent' ? 'routine' : 'urgent';

  return (
    <ReasonAction
      label={next === 'urgent' ? 'Escalate' : 'Step down'}
      icon={next === 'urgent' ? 'priority_high' : 'trending_down'}
      tone={next === 'urgent' ? 'danger' : 'default'}
      title={next === 'urgent' ? `Escalate ${name}` : `Step ${name} down`}
      prompt={next === 'urgent'
        ? 'They move ahead of everyone waiting. The next nurse sees why.'
        : 'They return to routine priority.'}
      placeholder={next === 'urgent'
        ? 'Deteriorated while waiting' : 'Reassessed, stable'}
      confirmLabel={next === 'urgent' ? 'Escalate' : 'Step down'}
      perform={(reason) => reprioritiseAction(mrn, next, reason)}
    />
  );
}
