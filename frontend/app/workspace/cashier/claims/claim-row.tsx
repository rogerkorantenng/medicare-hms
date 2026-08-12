'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { advanceClaimAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Card, Icon, StatusChip, AiPanel, money, when } from '@/components/ui';
import type { Claim } from '@/lib/repository/types';

const NEXT: Record<string, string | null> = {
  submitted: 'Authorise', authorised: 'Mark paid', paid: null,
};

export function ClaimRow({ claim }: { claim: Claim }) {
  const [draft, setDraft] = useState(claim.justification ?? '');
  const [drafted, setDrafted] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  async function draftJustification() {
    setLoading(true); setAiMessage(null);
    try {
      const res = await fetch('/api/ai/draft-claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimId: claim.id }),
      });
      const json = await res.json();
      if (json.ok) { setDraft(json.justification); setDrafted(true); }
      else setAiMessage(json.message ?? 'AI unavailable — write the justification manually.');
    } catch {
      setAiMessage('AI unavailable — write the justification manually.');
    } finally { setLoading(false); }
  }

  const next = NEXT[claim.status];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="val text-card">{claim.id}</h3>
            <StatusChip value={claim.status} />
          </div>
          <p className="text-support text-ink-soft mt-1">
            {claim.insurer} · invoice <span className="val">{claim.invoiceId}</span> · updated {when(claim.updatedAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="label">Claim amount</p>
          <p className="val text-xl font-bold">{money(claim.amount)}</p>
        </div>
      </div>

      <div className="field mt-4">
        <label htmlFor={`just-${claim.id}`}>Justification</label>
        <textarea
          id={`just-${claim.id}`} rows={3} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="State the services delivered and the clinical reason for them."
        />
      </div>

      {drafted && (
        <div className="mt-3">
          <AiPanel
            title="Drafted with AI"
            footnote="Read it and correct it before sending. The wording is yours once you submit."
          >
            The text above was drafted from the billed lines on this invoice.
          </AiPanel>
        </div>
      )}

      {aiMessage && (
        <p className="mt-3 rounded-control border border-warning-br bg-warning-bg px-3 py-2 text-support text-warning-fg">
          {aiMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn-secondary" onClick={draftJustification} disabled={loading}>
          <Icon name={loading ? 'progress_activity' : 'auto_awesome'} size={16}
                className={loading ? 'animate-spin' : ''} filled={!loading} />
          Draft justification
        </button>

        {next && (
          <button
            className="btn-primary ml-auto"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await advanceClaimAction(claim.id);
                toast(r.message, r.ok ? 'ok' : 'error');
                if (r.ok) router.refresh();
              })
            }
          >
            {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="arrow_forward" size={16} />}
            {next}
          </button>
        )}
      </div>
    </Card>
  );
}
