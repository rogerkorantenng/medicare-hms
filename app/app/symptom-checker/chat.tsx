'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui';

type Turn = { role: 'user' | 'assistant'; content: string };

const OPENER =
  'Hello. Tell me what you are feeling and roughly when it started, and I will help you work out who to see.';

/**
 * Multi-turn symptom checker.
 *
 * The non-diagnostic notice is permanent in the header, not a dismissible
 * banner. Once a specialty has been suggested a booking shortcut appears.
 */
export function SymptomChat() {
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', content: OPENER }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next = [...turns, { role: 'user' as const, content: text }];
    setTurns(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/symptom-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Only the conversation. The route adds the patient's own age, sex
        // and conditions server-side; nothing about anyone else is sent.
        body: JSON.stringify({ history: next.filter((t) => t.content !== OPENER) }),
      });
      const json = await res.json();
      if (json.ok) {
        setTurns([...next, { role: 'assistant', content: json.reply }]);
        if (json.suggestedSpecialty) setSpecialty(json.suggestedSpecialty);
        if (json.emergency) setEmergency(true);
      } else {
        setTurns([...next, { role: 'assistant', content: json.message ?? json.error }]);
      }
    } catch {
      setTurns([...next, {
        role: 'assistant',
        content: "I can't reach the service right now. For urgent symptoms call the emergency line or use Emergency on the home screen.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="pt-[62px] px-5 pb-3 bg-white border-b border-hairline sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <Link href="/app" className="grid place-items-center w-11 h-11 -ml-2 rounded-full" aria-label="Back">
            <Icon name="chevron_left" size={24} />
          </Link>
          <div>
            <h1 className="text-m-section flex items-center gap-1.5">
              <Icon name="auto_awesome" size={17} className="text-ai-fg" filled />
              Symptom checker
            </h1>
          </div>
        </div>
        {/* Permanent, not dismissible. */}
        <p className="mt-2.5 rounded-control bg-ai-bg border border-ai-br px-3 py-2 text-m-support text-ai-fg">
          This is guidance on who to see, not a diagnosis and not medical advice.
          It will never suggest a medication.
        </p>
      </header>

      <div className="flex-1 px-5 py-4 flex flex-col gap-3">
        {turns.map((t, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-card px-4 py-3 text-m-body ${
              t.role === 'user'
                ? 'self-end bg-primary text-white rounded-br-sm'
                : 'self-start bg-ai-bg border border-ai-br text-ink rounded-bl-sm'
            }`}
          >
            {t.content}
          </div>
        ))}

        {loading && (
          <div className="self-start rounded-card bg-ai-bg border border-ai-br px-4 py-3">
            <span className="flex gap-1" aria-label="Thinking">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-ai-fg animate-breathe"
                      style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </span>
          </div>
        )}

        {emergency && (
          <a href="tel:193" className="rounded-card border-2 border-danger-br bg-danger-bg p-4 flex items-center gap-3">
            <Icon name="e911_emergency" size={24} className="text-danger-fg" filled />
            <div>
              <p className="font-display font-extrabold text-danger-fg">Call the emergency line now</p>
              <p className="text-m-support text-danger-fg/80">Do not wait for an appointment.</p>
            </div>
          </a>
        )}

        {specialty && !emergency && (
          <Link
            href={`/app/book?specialty=${encodeURIComponent(specialty)}`}
            className="rounded-card border border-primary bg-primary-tint p-4 flex items-center gap-3"
          >
            <Icon name="event_available" size={22} className="text-primary" />
            <div>
              <p className="font-display font-extrabold text-primary">Book {specialty}</p>
              <p className="text-m-support text-primary/80">See the next available slot</p>
            </div>
            <Icon name="arrow_forward" size={19} className="text-primary ml-auto" />
          </Link>
        )}

        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-[72px] px-5 py-3 bg-white border-t border-hairline flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you are feeling"
          className="flex-1 min-h-[44px]"
          disabled={loading}
        />
        <button className="btn-primary min-w-[48px] min-h-[44px]" disabled={loading || !input.trim()} aria-label="Send">
          <Icon name="send" size={19} />
        </button>
      </form>
    </div>
  );
}
