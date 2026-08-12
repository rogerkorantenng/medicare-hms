import { Suspense } from 'react';
import { LoginForm } from './login-form';
import { Icon } from '@/components/ui';

export const metadata = { title: 'Sign in — MediCare+' };

/**
 * The nine role accounts from the design. Selecting one fills the email so an
 * examiner can move between roles quickly; the password is still required,
 * because the accounts are real rows in the users table with argon2 hashes,
 * rather than the hardcoded list v1.0 used.
 */
const ROLES = [
  { email: 'doctor@medicare.com',    label: 'Doctor',       icon: 'stethoscope',      dept: 'Cardiology' },
  { email: 'nurse@medicare.com',     label: 'Nurse',        icon: 'vaccines',         dept: 'Outpatient' },
  { email: 'reception@medicare.com', label: 'Receptionist', icon: 'support_agent',    dept: 'Front Desk' },
  { email: 'lab@medicare.com',       label: 'Laboratory',   icon: 'science',          dept: 'Laboratory' },
  { email: 'radiology@medicare.com', label: 'Radiology',    icon: 'radiology',        dept: 'Radiology' },
  { email: 'pharmacy@medicare.com',  label: 'Pharmacist',   icon: 'pill',             dept: 'Pharmacy' },
  { email: 'cashier@medicare.com',   label: 'Cashier',      icon: 'payments',         dept: 'Accounts' },
  { email: 'admin@medicare.com',     label: 'Administrator',icon: 'admin_panel_settings', dept: 'Administration' },
  { email: 'patient@medicare.com',   label: 'Patient',      icon: 'person',           dept: 'Patient app' },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left: identity. Gradient runs primary-bright to primary-deep. */}
      <section className="hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-primary-bright to-primary-deep">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-10 h-10 rounded-control bg-white/15">
            <Icon name="health_and_safety" size={24} filled />
          </span>
          <span className="font-display font-extrabold text-lg">MediCare+</span>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl font-extrabold leading-tight">
            One hospital, one record.
          </h1>
          <p className="mt-4 text-white/80 leading-relaxed">
            Reception, triage, consultation, laboratory, radiology, pharmacy, wards
            and billing — sharing a single patient record rather than nine copies of it.
          </p>
          <ul className="mt-8 space-y-3 text-white/80 text-support">
            {[
              ['verified_user', 'Access is enforced in the database, not the interface'],
              ['lab_profile', 'A result reaches nobody until a technician verifies it'],
              ['history', 'Every clinical action is written to an append-only audit trail'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon name={icon} size={18} className="mt-px" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-white/50 text-support">
          All data in this system is synthetic. No real patient data appears anywhere.
        </p>
      </section>

      {/* Right: the form. */}
      <section className="flex items-center justify-center p-6 sm:p-12 bg-surface-page">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="grid place-items-center w-10 h-10 rounded-control bg-primary text-white">
              <Icon name="health_and_safety" size={24} filled />
            </span>
            <span className="font-display font-extrabold text-lg">MediCare+</span>
          </div>

          <h2 className="text-title">Sign in</h2>
          <p className="text-support text-ink-soft mt-1">
            Choose a role to fill its email, then enter the password.
          </p>

          {/* The form reads ?next= to return you where you were headed,
              which means it needs a Suspense boundary to prerender. */}
          <Suspense fallback={<div className="mt-7 h-96 rounded-card bg-white/50 animate-pulse" />}>
            <LoginForm roles={ROLES} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
