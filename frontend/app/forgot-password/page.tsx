import Link from 'next/link';
import { Icon } from '@/components/ui';
import { ForgotForm } from './forgot-form';

export const metadata = { title: 'Forgotten password — MediCare+' };

/**
 * There is no outbound email in this system, and a reset link that never
 * arrives is worse than no reset at all: somebody would wait for it.
 *
 * So this raises a request the front desk can see and act on in person,
 * against photo identification, which is how a hospital establishes who
 * somebody is anyway. The screen says exactly that, rather than implying
 * an email is on its way.
 */
export default function ForgotPassword() {
  return (
    <main className="min-h-screen bg-surface-page grid place-items-center p-6">
      <div className="w-full max-w-md">
        <Link href="/login" className="btn-ghost -ml-2 mb-4">
          <Icon name="chevron_left" size={18} />Back to sign in
        </Link>

        <h1 className="text-title">Forgotten your password?</h1>
        <p className="text-support text-ink-soft mt-2 leading-relaxed">
          Tell us the address on your account. Reception will see the request
          and can set a new password for you at the front desk, or over the
          phone once they have confirmed who you are.
        </p>

        <ForgotForm />

        <div className="mt-8 rounded-card border border-hairline bg-white p-4">
          <p className="label mb-2">What to bring</p>
          <ul className="flex flex-col gap-2 text-support text-ink-soft">
            {[
              ['badge', 'Photo identification'],
              ['smartphone', 'The phone number on your record, if you have it'],
              ['schedule', 'Reception is open from 07:00 to 19:00'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-start gap-2">
                <Icon name={icon} size={16} className="mt-0.5 text-ink-faint" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-chip text-ink-faint mt-6">
          Staff: your administrator can reset your password from the Staff
          screen. The same request reaches them.
        </p>
      </div>
    </main>
  );
}
