import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { TabBar } from './tab-bar';

/**
 * The patient application. The mobile surface is primary; the desktop view
 * mirrors it, centred, for use at a kiosk or a reception terminal.
 *
 * Layout is correct from 360px, touch targets are at least 44 by 44px, and
 * nesting never goes deeper than two levels.
 */
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.role !== 'patient') redirect(`/workspace/${user.role}`);

  return (
    <div className="min-h-screen bg-surface-mobile flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-surface-mobile flex flex-col relative">
        <main className="flex-1 pb-24">{children}</main>
        <TabBar />
      </div>
    </div>
  );
}
