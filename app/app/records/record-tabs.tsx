'use client';

import { useState } from 'react';
import { Icon, Chip, StatusChip, money, onlyDate } from '@/components/ui';
import { ExplainResult } from '@/components/explain-result';
import { PaySheet } from './pay-sheet';
import type { PatientChart } from '@/lib/repository/types';

const TABS = [
  { id: 'results', label: 'Results' },
  { id: 'meds', label: 'Medications' },
  { id: 'bills', label: 'Bills' },
];

export function RecordTabs({ chart, initialTab }: { chart: PatientChart; initialTab: string }) {
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : 'results');

  return (
    <>
      <div className="flex gap-1 px-5 pt-3 bg-white border-b border-hairline sticky top-0 z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-h-[44px] pb-2.5 border-b-2 font-display font-bold text-m-body transition
              ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-soft'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-5 flex flex-col gap-3">
        {tab === 'results' && (
          chart.labs.length === 0 ? (
            <Empty icon="lab_profile" text="No results yet. You will be alerted when one is ready." />
          ) : chart.labs.map((l) => (
            <article key={l.id} className="rounded-card bg-white border border-hairline p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-extrabold">{l.testName}</p>
                  <p className="val text-m-support text-ink-soft mt-0.5">
                    {l.resultValue}{l.refRange ? ` · normal ${l.refRange}` : ''}
                  </p>
                </div>
                {l.flag && <StatusChip value={l.flag} />}
              </div>
              <p className="val text-m-chip text-ink-faint mt-2">{onlyDate(l.createdAt)}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <ExplainResult
                  endpoint="/api/ai/explain-result-patient"
                  body={{ labOrderId: l.id }}
                  label="What does this mean?"
                  notice="This is a plain-language explanation, not medical advice and not a diagnosis. Your care team can talk it through with you."
                />
              </div>
            </article>
          ))
        )}

        {tab === 'meds' && (
          chart.prescriptions.length === 0 ? (
            <Empty icon="pill" text="No medications on record." />
          ) : chart.prescriptions.map((r) => (
            <article key={r.id} className="rounded-card bg-white border border-hairline p-4 flex items-center gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-primary-tint text-primary shrink-0">
                <Icon name="pill" size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate">{r.drug}</p>
                <p className="text-m-support text-ink-soft">
                  {r.dose} · {r.frequency} · {r.duration}
                </p>
              </div>
              {r.status === 'dispensed'
                ? <Chip tone="success">Collected</Chip>
                : <Chip tone="warning">To collect</Chip>}
            </article>
          ))
        )}

        {tab === 'bills' && (
          chart.invoices.length === 0 ? (
            <Empty icon="receipt_long" text="Nothing to pay." />
          ) : chart.invoices.map((inv) => (
            <article key={inv.id} className="rounded-card bg-white border border-hairline p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="val font-display font-extrabold">{inv.id}</p>
                <StatusChip value={inv.status} />
              </div>
              <ul className="mt-3">
                {inv.lines.map((l) => (
                  <li key={l.id} className="flex justify-between py-1.5 text-m-body border-b border-hairline">
                    <span className="text-ink-soft">{l.description}</span>
                    <span className="val">{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center mt-3">
                <span className="label">Balance</span>
                <span className="val font-bold text-lg">{money(Math.max(0, inv.total - inv.paid))}</span>
              </div>
              {inv.total > inv.paid && <PaySheet invoice={inv} />}
            </article>
          ))
        )}
      </div>
    </>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="rounded-card bg-white border border-hairline p-8 text-center">
      <span className="grid place-items-center w-12 h-12 mx-auto rounded-full bg-primary-tint text-primary">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-m-support text-ink-soft mt-3">{text}</p>
    </div>
  );
}
