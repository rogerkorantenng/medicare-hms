'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';
import { STEPS } from './steps';

const KEY = 'medicare.onboarded';

/**
 * Four screens, shown once, on the way to signing in. Skippable from the
 * first: somebody returning on a new phone should not sit through it.
 */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  // Someone who has already seen it should never see it again, including
  // when they land here from a bookmark.
  useEffect(() => {
    if (localStorage.getItem(KEY)) router.replace('/login');
  }, [router]);

  function finish() {
    localStorage.setItem(KEY, 'seen');
    router.replace('/login');
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <main className="min-h-screen bg-surface-mobile flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col px-5 pt-[62px] pb-8">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-control bg-primary text-white">
              <Icon name="health_and_safety" size={20} filled />
            </span>
            <span className="font-display font-extrabold">MediCare+</span>
          </span>
          {!last && (
            <button className="btn-ghost text-m-support" onClick={finish}>Skip</button>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-primary-tint text-primary">
            <Icon name={current.icon} size={28} filled />
          </span>
          <h1 className="font-display text-2xl font-extrabold mt-5">{current.title}</h1>
          <p className="text-m-body text-ink-soft mt-2 leading-relaxed">{current.body}</p>
          <div className="mt-6">{current.preview}</div>
        </div>

        <div className="flex items-center gap-1.5 justify-center mb-5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-primary' : 'w-1.5 bg-ink-disabled'}`} />
          ))}
        </div>

        <button className="btn-primary w-full min-h-[50px]"
                onClick={() => (last ? finish() : setStep(step + 1))}>
          {last ? 'Get started' : 'Next'}
          <Icon name="arrow_forward" size={18} />
        </button>
      </div>
    </main>
  );
}
