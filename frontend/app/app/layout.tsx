import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { TabBar } from './tab-bar';
import { SideNav } from './side-nav';
import { MustChangePassword } from '@/components/must-change-password';

/**
 * The patient application, at whatever width it is opened.
 *
 * It used to render as a 430px column marooned in the middle of a desktop
 * monitor, because the mobile layout was pinned rather than allowed to
 * grow. Below 768px it is still a phone: one column, bottom tab bar,
 * 44px touch targets. Above that it gets a sidebar and room to breathe.
 *
 * The decision is made in CSS, not by reading the user agent, so a phone
 * turned sideways and a browser window dragged narrow both behave the way
 * their width says they should. There is no redirect and no second set of
 * routes to keep in step.
 */
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  // Not merely signed out: the cookie may be present but rejected by the
  // API, in which case it has to be cleared or the middleware sends the
  // visitor straight back here. See app/api/session/end.
  if (!user) redirect('/api/session/end?next=/app');
  if (user.role !== 'patient') redirect(`/workspace/${user.role}`);

  return (
    <div className="min-h-screen bg-surface-mobile md:bg-surface-page md:flex">
      <SideNav name={user.fullName} mrn={user.mrn} />

      <div className="flex-1 min-w-0 flex justify-center">
        <div className="w-full max-w-[430px] md:max-w-[860px] min-h-screen flex flex-col">
          {user.mustChangePassword && (
            <div className="px-5 pt-5 md:px-8">
              <MustChangePassword href="/app/profile" />
            </div>
          )}
          <main className="flex-1 pb-24 md:pb-8">{children}</main>
        </div>
      </div>

      <TabBar />
    </div>
  );
}
