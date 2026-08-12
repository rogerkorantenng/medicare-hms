'use client';

import { useState } from 'react';
import { Icon, AiPanel } from '@/components/ui';

/**
 * The explain button, shared by the clinician and patient result views.
 *
 * Output is purple with a sparkle, so a suggestion is never confusable with a
 * recorded fact. A failure shows a plain message and the workflow continues —
 * the reference range is on screen either way.
 */
export function ExplainResult({
  endpoint, body, label = 'Explain', notice,
}: {
  endpoint: string;
  body: Record<string, unknown>;
  label?: string;
  notice?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setFailed(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) setText(json.explanation);
      else setFailed(json.message ?? json.error ?? 'AI unavailable.');
    } catch {
      setFailed('AI unavailable.');
    } finally {
      setLoading(false);
    }
  }

  if (text) {
    return (
      <div className="w-full mt-2">
        <AiPanel title="What this means" footnote={notice}>{text}</AiPanel>
      </div>
    );
  }

  return (
    <>
      <button className="btn-secondary" onClick={run} disabled={loading}>
        <Icon name={loading ? 'progress_activity' : 'auto_awesome'} size={16}
              className={loading ? 'animate-spin' : ''} filled={!loading} />
        {label}
      </button>
      {failed && (
        <p className="w-full mt-2 rounded-control border border-warning-br bg-warning-bg px-3 py-2 text-support text-warning-fg">
          {failed}
        </p>
      )}
    </>
  );
}
