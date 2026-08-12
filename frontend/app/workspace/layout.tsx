import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { Shell } from '@/components/shell/shell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  // Not merely signed out: the cookie may be present but rejected by the
  // API, in which case it has to be cleared or the middleware sends the
  // visitor straight back here. See app/api/session/end.
  if (!user) redirect(`/api/session/end?next=/workspace`);
  // A patient has no workspace. Their surface is the mobile application.
  if (user.role === 'patient') redirect('/app');

  return (
    <Shell role={user.role} fullName={user.fullName} department={user.department}>
      {children}
    </Shell>
  );
}
