'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordPaymentAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Icon, money } from '@/components/ui';
import type { Invoice, MomoProvider } from '@/lib/repository/types';

/** Provider colours come from the token table, so they read as themselves. */
const PROVIDERS: { name: MomoProvider; className: string }[] = [
  { name: 'MTN MoMo', className: 'bg-momo-mtn text-momo-mtnInk border-momo-mtn' },
  { name: 'Telecel Cash', className: 'bg-momo-telecel text-white border-momo-telecel' },
  { name: 'AT Money', className: 'bg-momo-at text-white border-momo-at' },
];

type Step = 'closed' | 'cash' | 'provider' | 'wallet' | 'awaiting' | 'done';

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const balance = Math.max(0, invoice.total - invoice.paid);
  const [step, setStep] = useState<Step>('closed');
  const [amount, setAmount] = useState(String(balance.toFixed(2)));
  const [provider, setProvider] = useState<MomoProvider | null>(null);
  const [wallet, setWallet] = useState('');
  const [reference, setReference] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function close() { setStep('closed'); setProvider(null); setWallet(''); }

  function record(method: 'cash' | 'momo') {
    start(async () => {
      const r = await recordPaymentAction(invoice.id, Number(amount), method, provider ?? undefined);
      if (!r.ok) { toast(r.message, 'error'); return; }
      if (method === 'momo') {
        setReference(`MM${Date.now().toString().slice(-8)}`);
        setStep('done');
      } else {
        toast(`Payment recorded against ${invoice.id}.`);
        close();
      }
      router.refresh();
    });
  }

  /**
   * The gateway step is modelled, exactly as it was in v1.0. When a real
   * provider is wired in, only this waiting step is replaced — the sequence
   * around it stays as it is.
   */
  function sendRequest() {
    setStep('awaiting');
    setTimeout(() => record('momo'), 2200);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-hairline">
        <a href={`/print/receipt/${invoice.id}`} target="_blank" rel="noreferrer" className="btn-ghost">
          <Icon name="print" size={16} />Print receipt
        </a>
        {balance > 0 && (
          <>
            <button className="btn-secondary ml-auto" onClick={() => { setAmount(balance.toFixed(2)); setStep('cash'); }}>
              <Icon name="payments" size={16} />Record cash
            </button>
            <button className="btn-primary" onClick={() => { setAmount(balance.toFixed(2)); setStep('provider'); }}>
              <Icon name="smartphone" size={16} />Mobile Money
            </button>
          </>
        )}
      </div>

      {step !== 'closed' && (
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-sidebar/50 p-0 sm:p-4" onClick={close}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-sheet sm:rounded-modal p-6 animate-fadeUp"
            onClick={(e) => e.stopPropagation()}
          >
            {step === 'cash' && (
              <>
                <h3 className="text-section">Record a cash payment</h3>
                <p className="text-support text-ink-soft mt-1">{invoice.id} · balance {money(balance)}</p>
                <div className="field mt-4">
                  <label htmlFor="amt">Amount received</label>
                  <input id="amt" type="number" step="0.01" min="0.01" className="val" autoFocus
                         value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="flex gap-2 mt-5">
                  <button className="btn-ghost flex-1" onClick={close}>Cancel</button>
                  <button className="btn-primary flex-1" disabled={pending || Number(amount) <= 0}
                          onClick={() => record('cash')}>
                    {pending ? <Icon name="progress_activity" className="animate-spin" size={16} /> : <Icon name="check" size={16} />}
                    Record payment
                  </button>
                </div>
              </>
            )}

            {step === 'provider' && (
              <>
                <h3 className="text-section">Mobile Money</h3>
                <p className="text-support text-ink-soft mt-1">Choose the patient&apos;s provider.</p>
                <div className="flex flex-col gap-2 mt-4">
                  {PROVIDERS.map((p) => (
                    <button key={p.name}
                            className={`rounded-control border-2 px-4 py-3 font-display font-bold text-left ${p.className}`}
                            onClick={() => { setProvider(p.name); setStep('wallet'); }}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <button className="btn-ghost w-full mt-4" onClick={close}>Cancel</button>
              </>
            )}

            {step === 'wallet' && (
              <>
                <h3 className="text-section">{provider}</h3>
                <p className="text-support text-ink-soft mt-1">
                  A prompt is sent to the wallet. The patient approves it with their PIN.
                </p>
                <div className="field mt-4">
                  <label htmlFor="wallet">Wallet number</label>
                  <input id="wallet" className="val" autoFocus value={wallet}
                         onChange={(e) => setWallet(e.target.value)} placeholder="024 000 0000" />
                </div>
                <div className="field mt-3">
                  <label htmlFor="mamt">Amount</label>
                  <input id="mamt" type="number" step="0.01" className="val" value={amount}
                         onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="flex gap-2 mt-5">
                  <button className="btn-ghost flex-1" onClick={() => setStep('provider')}>Back</button>
                  <button className="btn-primary flex-1" disabled={wallet.trim().length < 9} onClick={sendRequest}>
                    <Icon name="send" size={16} />Send request
                  </button>
                </div>
              </>
            )}

            {step === 'awaiting' && (
              <div className="text-center py-6">
                <span className="grid place-items-center w-14 h-14 mx-auto rounded-full bg-primary-tint text-primary animate-breathe">
                  <Icon name="smartphone" size={28} filled />
                </span>
                <h3 className="text-section mt-3">Waiting for approval</h3>
                <p className="text-support text-ink-soft mt-1">
                  The patient is approving {money(Number(amount))} on {wallet} with their PIN.
                </p>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center py-4">
                <span className="grid place-items-center w-14 h-14 mx-auto rounded-full bg-success-bg text-success-fg">
                  <Icon name="check_circle" size={28} filled />
                </span>
                <h3 className="text-section mt-3">Payment received</h3>
                <p className="text-support text-ink-soft mt-1">
                  {money(Number(amount))} against {invoice.id} via {provider}.
                </p>
                <p className="val text-support mt-3 rounded-control bg-surface-wash px-3 py-2">
                  Reference {reference}
                </p>
                <p className="text-support text-ink-soft mt-3">
                  The audit trail records this as “Payment recorded (MoMo · {provider}) {invoice.id}”.
                </p>
                <button className="btn-primary w-full mt-5" onClick={close}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
