'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';

/**
 * Each step previews the thing it describes rather than illustrating it:
 * a picture of a feature teaches less than the feature itself at a third
 * of the size.
 */
export type Step = { icon: string; title: string; body: string; preview: ReactNode };

export const STEPS: Step[] = [
  {
    icon: 'event_available',
    title: 'Book without queueing',
    body: 'Choose a doctor and a time. Slots already taken are struck through, so you never pick one that has gone.',
    preview: (
      <div className="flex flex-col gap-2">
        {[['09:00', false], ['09:30', true], ['10:00', false]].map(([time, taken]) => (
          <div key={String(time)}
               className={`rounded-control border px-3 py-2 text-m-body flex items-center justify-between
                 ${taken ? 'border-hairline text-ink-faint line-through' : 'border-primary bg-primary-tint text-primary'}`}>
            <span className="val">{time}</span>
            {!taken && <Icon name="check_circle" size={16} />}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: 'lab_profile',
    title: 'Results when they are ready',
    body: 'A result reaches you only after a laboratory technician has verified it. Nothing provisional is ever shown to you.',
    preview: (
      <div className="rounded-control border border-hairline bg-white p-3">
        <p className="text-m-body font-display font-bold">Lipid Panel</p>
        <p className="val text-m-support text-ink-soft mt-0.5">LDL 128 mg/dL</p>
        <span className="chip-success mt-2 inline-flex">Verified and released</span>
      </div>
    ),
  },
  {
    icon: 'chat',
    title: 'Not sure who to see?',
    body: 'Describe your symptoms and get pointed at the right specialty and how soon to be seen. It never diagnoses and never names a medicine.',
    preview: (
      <div className="rounded-card border border-ai-br bg-ai-bg p-3">
        <p className="text-m-support text-ai-fg">
          Based on what you have described, Cardiology is the right specialty.
          Please be seen within 24 hours.
        </p>
      </div>
    ),
  },
  {
    icon: 'payments',
    title: 'Pay by Mobile Money',
    body: 'Settle a bill with MTN MoMo, Telecel Cash or AT Money and keep the receipt on your phone.',
    preview: (
      <div className="rounded-control border border-hairline bg-white p-3 flex items-center justify-between">
        <span className="text-m-body">INV-2088</span>
        <span className="val text-m-body font-bold">GHS 360.00</span>
      </div>
    ),
  },
];
