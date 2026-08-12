import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { Shell } from '@/components/shell/shell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  // A patient has no workspace. Their surface is the mobile application.
  if (user.role === 'patient') redirect('/app');

  return (
    <Shell role={user.role} fullName={user.fullName} department={user.department}>
      {children}
    </Shell>
  );
}
