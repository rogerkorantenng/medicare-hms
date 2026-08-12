'use client';

import { useState } from 'react';
import { Card, Chip, StatusChip, EmptyState, Icon, money, when, onlyDate } from '@/components/ui';
import { ExplainResult } from '@/components/explain-result';
import type { PatientChart } from '@/lib/repository/types';

const TABS = [
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'vitals', label: 'Vitals', icon: 'monitor_heart' },
  { id: 'results', label: 'Results', icon: 'lab_profile' },
  { id: 'meds', label: 'Medications', icon: 'pill' },
  { id: 'billing', label: 'Billing', icon: 'receipt_long' },
  { id: 'documents', label: 'Documents', icon: 'folder' },
] as const;

/** A small systolic trend, drawn inline rather than pulling in a chart library. */
function SystolicTrend({ points }: { points: { at: string; systolic: number }[] }) {
  if (points.length < 2) return null;
  const w = 520, h = 120, pad = 8;
  const values = points.map((p) => p.systolic);
  const min = Math.min(...values) - 10, max = Math.max(...values) + 10;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.systolic)}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[320px]" role="img"
           aria-label="Systolic blood pressure over time">
        <line x1={pad} y1={y(140)} x2={w - pad} y2={y(140)} stroke="#FDE68A" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke="#1D4ED8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.at} cx={x(i)} cy={y(p.systolic)} r={3.5} fill="#1D4ED8" />
        ))}
      </svg>
      <p className="text-support text-ink-soft mt-1">
        Systolic, oldest to newest. The dashed line marks 140 mmHg.
      </p>
    </div>
  );
}

export function ChartTabs({ chart, clinical }: { chart: PatientChart; clinical: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>(clinical ? 'timeline' : 'billing');

  const trend = [...chart.vitals]
    .filter((v) => v.systolic != null)
    .reverse()
    .map((v) => ({ at: v.recordedAt, systolic: v.systolic as number }));

  return (
    <>
      <div className="flex gap-1 overflow-x-auto mb-4 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 whitespace-nowrap border-b-2 transition font-display font-semibold text-body
              ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            <Icon name={t.icon} size={17} filled={tab === t.id} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'timeline' && (
        <Card>
          {chart.encounters.length === 0 ? (
            <EmptyState icon="timeline" title="No consultations recorded"
                        hint={clinical ? undefined : 'Your role cannot read consultation notes.'} />
          ) : (
            <ul className="flex flex-col gap-4">
              {chart.encounters.map((e) => (
                <li key={e.id} className="border-l-2 border-primary pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-bold">{e.diagnosis}</p>
                    {e.aiAssisted && <Chip tone="ai" icon="auto_awesome">AI-assisted draft</Chip>}
                  </div>
                  <p className="text-support text-ink-soft mt-0.5">{e.complaint}</p>
                  {e.notes && <p className="text-body mt-2 whitespace-pre-wrap">{e.notes}</p>}
                  <p className="val text-chip text-ink-faint mt-1.5">
                    {when(e.createdAt)} · {e.doctorName ?? ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'vitals' && (
        <div className="flex flex-col gap-4">
          {trend.length >= 2 && <Card title="Systolic trend"><SystolicTrend points={trend} /></Card>}
          <Card title="Recorded observations">
            {chart.vitals.length === 0 ? (
              <EmptyState icon="monitor_heart" title="No vitals recorded"
                          hint={clinical ? undefined : 'Your role cannot read vitals.'} />
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full min-w-[640px] text-body">
                  <thead>
                    <tr>
                      <th className="th pl-5">When</th><th className="th">BP</th><th className="th">Pulse</th>
                      <th className="th">Temp</th><th className="th">SpO₂</th><th className="th">Weight</th>
                      <th className="th pr-5">Acuity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.vitals.map((v) => (
                      <tr key={v.id} className="row-hover">
                        <td className="td pl-5 val text-support">{when(v.recordedAt)}</td>
                        <td className="td val">{v.systolic ?? '—'}/{v.diastolic ?? '—'}</td>
                        <td className="td val">{v.pulse ?? '—'}</td>
                        <td className="td val">{v.temperature ?? '—'}</td>
                        <td className="td val">{v.spo2 ?? '—'}</td>
                        <td className="td val">{v.weightKg ?? '—'}</td>
                        <td className="td pr-5">{v.acuity ? <StatusChip value={v.acuity} /> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'results' && (
        <div className="flex flex-col gap-4">
          <Card title="Laboratory">
            {chart.labs.length === 0 ? (
              <EmptyState icon="science" title="No laboratory results"
                          hint={clinical ? undefined : 'Your role cannot read results.'} />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {chart.labs.map((l) => (
                  <li key={l.id} className="rounded-row border border-hairline p-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-[11rem] flex-1">
                      <p className="font-display font-bold">{l.testName}</p>
                      <p className="val text-support text-ink-soft">
                        {l.resultValue ?? 'awaiting result'}{l.refRange ? ` · ref ${l.refRange}` : ''}
                      </p>
                    </div>
                    {l.flag && <StatusChip value={l.flag} />}
                    <StatusChip value={l.status} />
                    <span className="val text-support text-ink-soft">{when(l.createdAt)}</span>
                    {l.status === 'verified' && l.resultValue && (
                      <ExplainResult
                        endpoint="/api/ai/explain-result"
                        body={{ testName: l.testName, resultValue: l.resultValue, refRange: l.refRange, flag: l.flag }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {chart.imaging.length > 0 && (
            <Card title="Imaging">
              <ul className="flex flex-col gap-2.5">
                {chart.imaging.map((i) => (
                  <li key={i.id} className="rounded-row border border-hairline p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display font-bold flex-1">{i.modality} · {i.bodyRegion}</p>
                      <StatusChip value={i.status} />
                      <span className="val text-support text-ink-soft">{when(i.createdAt)}</span>
                    </div>
                    {i.findings && <p className="text-body mt-2 whitespace-pre-wrap">{i.findings}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'meds' && (
        <Card>
          {chart.prescriptions.length === 0 ? (
            <EmptyState icon="pill" title="No prescriptions"
                        hint={clinical ? undefined : 'Your role cannot read prescriptions.'} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {chart.prescriptions.map((r) => (
                <li key={r.id} className="rounded-row border border-hairline p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-display font-bold">{r.drug}</p>
                    <p className="text-support text-ink-soft">{r.dose} · {r.frequency} · {r.duration}</p>
                  </div>
                  <span className="val text-support">× {r.quantity}</span>
                  <StatusChip value={r.status} />
                  <span className="val text-support text-ink-soft">{when(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'billing' && (
        <div className="flex flex-col gap-4">
          {chart.invoices.length === 0 ? (
            <Card><EmptyState icon="receipt_long" title="No invoices" /></Card>
          ) : chart.invoices.map((inv) => (
            <Card key={inv.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="val text-card">{inv.id}</h3>
                  <StatusChip value={inv.status} />
                </div>
                <p className="val text-body">
                  <span className="font-bold">{money(inv.paid)}</span>
                  <span className="text-ink-soft"> paid of {money(inv.total)}</span>
                </p>
              </div>
              <ul className="mt-3 border-t border-hairline">
                {inv.lines.map((l) => (
                  <li key={l.id} className="flex justify-between py-2 border-b border-hairline text-body">
                    <span>{l.description}</span>
                    <span className="val">{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {tab === 'documents' && (
        <Card>
          {chart.documents.length === 0 ? (
            <EmptyState icon="folder_open" title="No documents"
                        hint={clinical ? undefined : 'Your role cannot read clinical documents.'} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {chart.documents.map((d) => (
                <li key={d.id} className="rounded-row border border-hairline p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Icon name="description" size={20} className="text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold">{d.title}</p>
                      <p className="text-support text-ink-soft">{d.kind}</p>
                    </div>
                    <span className="val text-support text-ink-soft">{onlyDate(d.docDate)}</span>
                  </div>
                  {d.body && (
                    <pre className="mt-3 whitespace-pre-wrap font-body text-body bg-surface-wash rounded-control p-3">
                      {d.body}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
