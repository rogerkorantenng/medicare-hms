import { Onboarding } from './onboarding';

export const metadata = { title: 'Welcome — MediCare+' };

/**
 * Shown once, before signing in. The middleware treats /welcome as public
 * so a first-time visitor is not bounced away from it.
 */
export default function Welcome() {
  return <Onboarding />;
}
