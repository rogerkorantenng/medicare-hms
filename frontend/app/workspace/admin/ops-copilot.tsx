'use client';

import { useState } from 'react';
import { Card, Icon, AiPanel } from '@/components/ui';

const SUGGESTIONS = [
  'Which ward is closest to full?',
  'How much revenue is outstanding?',
  'How many laboratory orders are still pending?',
  'How many staff are on duty?',
];

/**
 * The snapshot is assembled on the server and passed as system context, so
 * the model answers only from figures that are actually in front of it. If it
 * is not in the snapshot, it says so rather than guessing.
 */
export function OpsCopilot() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true); setAnswer(null); setFailed(null);
    try {
      const res = await fetch('/api/ai/ops', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      if (json.ok) setAnswer(json.answer);
      else setFailed(json.message ?? json.error ?? 'AI unavailable right now — check the dashboards above.');
    } catch {
      setFailed('AI unavailable right now — check the dashboards above.');
    } finally { setLoading(false); }
  }

  return (
    <Card
      title={
        <h2 className="text-card flex items-center gap-1.5">
          <Icon name="auto_awesome" size={17} className="text-ai-fg" filled />
          Operations copilot
        </h2>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about occupancy, queues, revenue or staffing"
          className="flex-1"
        />
        <button className="btn-primary" disabled={loading || !question.trim()}>
          {loading ? <Icon name="progress_activity" className="animate-spin" size={17} /> : <Icon name="send" size={17} />}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip-neutral hover:bg-primary-tint hover:text-primary transition"
                  onClick={() => { setQuestion(s); ask(s); }}>
            {s}
          </button>
        ))}
      </div>

      {answer && (
        <div className="mt-4">
          <AiPanel title="From the live snapshot"
                   footnote="Answered from the figures above only. Nothing here is speculation.">
            {answer}
          </AiPanel>
        </div>
      )}

      {failed && (
        <p className="mt-4 rounded-control border border-warning-br bg-warning-bg px-3 py-2 text-support text-warning-fg">
          {failed}
        </p>
      )}
    </Card>
  );
}
