'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordPaymentAction } from '@/app/actions';
import { Icon, money } from '@/components/ui';
import type { Invoice, MomoProvider } from '@/lib/repository/types';

const PROVIDERS: { name: MomoProvider; className: string }[] = [
  { name: 'MTN MoMo', className: 'bg-momo-mtn text-momo-mtnInk border-momo-mtn' },
  { name: 'Telecel Cash', className: 'bg-momo-telecel text-white border-momo-telecel' },
  { name: 'AT Money', className: 'bg-momo-at text-white border-momo-at' },
];

type Step = 'closed' | 'provider' | 'wallet' | 'awaiting' | 'done';

/** Bottom sheet, 28px top corners only. */
export function PaySheet({ invoice }: { invoice: Invoice }) {
  const balance = Math.max(0, invoice.total - invoice.paid);
  const [step, setStep] = useState<Step>('closed');
  const [provider, setProvider] = useState<MomoProvider | null>(null);
  const [wallet, setWallet] = useState('');
  const [reference, setReference] = useState('');
  const [, start] = useTransition();
  const router = useRouter();

  function send() {
    setStep('awaiting');
    setTimeout(() => {
      start(async () => {
        const r = await recordPaymentAction(invoice.id, balance, 'momo', provider ?? undefined);
        if (r.ok) {
          setReference(`MM${Date.now().toString().slice(-8)}`);
          setStep('done');
          router.refresh();
        } else {
          setStep('wallet');
        }
      });
    }, 2200);
  }

  return (
    <>
      <button className="btn-primary w-full mt-3 min-h-[44px]" onClick={() => setStep('provider')}>
        <Icon name="smartphone" size={17} />Pay {money(balance)}
      </button>

      {step !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-sidebar/50"
             onClick={() => step !== 'awaiting' && setStep('closed')}>
          <div
            className="w-full max-w-[430px] bg-white rounded-t-sheet p-5 pb-8 animate-fadeUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-ink-disabled mx-auto mb-4" aria-hidden="true" />

            {step === 'provider' && (
              <>
                <h3 className="text-m-section">Pay with Mobile Money</h3>
                <p className="text-m-support text-ink-soft mt-1">{invoice.id} · {money(balance)}</p>
                <div className="flex flex-col gap-2.5 mt-4">
                  {PROVIDERS.map((p) => (
                    <button key={p.name}
                            className={`rounded-control border-2 px-4 min-h-[52px] font-display font-bold text-left ${p.className}`}
                            onClick={() => { setProvider(p.name); setStep('wallet'); }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 'wallet' && (
              <>
                <h3 className="text-m-section">{provider}</h3>
                <p className="text-m-support text-ink-soft mt-1">
                  We will send a prompt to your phone. Approve it with your PIN.
                </p>
                <div className="field mt-4">
                  <label htmlFor="w">Wallet number</label>
                  <input id="w" className="val min-h-[44px]" inputMode="tel" autoFocus value={wallet}
                         onChange={(e) => setWallet(e.target.value)} placeholder="024 000 0000" />
                </div>
                <button className="btn-primary w-full mt-4 min-h-[48px]"
                        disabled={wallet.trim().length < 9} onClick={send}>
                  <Icon name="send" size={17} />Send request for {money(balance)}
                </button>
              </>
            )}

            {step === 'awaiting' && (
              <div className="text-center py-8">
                <span className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-primary-tint text-primary animate-breathe">
                  <Icon name="smartphone" size={30} filled />
                </span>
                <h3 className="text-m-section mt-4">Check your phone</h3>
                <p className="text-m-support text-ink-soft mt-1">
                  Approve {money(balance)} on {wallet} with your PIN.
                </p>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center py-4">
                <span className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-success-bg text-success-fg">
                  <Icon name="check_circle" size={30} filled />
                </span>
                <h3 className="text-m-section mt-4">Payment received</h3>
                <p className="text-m-support text-ink-soft mt-1">
                  {money(balance)} paid towards {invoice.id}.
                </p>
                <p className="val text-m-support mt-4 rounded-control bg-surface-wash px-3 py-2.5">
                  Reference {reference}
                </p>
                <button className="btn-primary w-full mt-5 min-h-[48px]" onClick={() => setStep('closed')}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
