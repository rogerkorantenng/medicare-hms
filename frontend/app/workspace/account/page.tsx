import { currentUser } from '@/lib/session';
import { PageHeader, Card, Avatar, Chip } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/nav';
import { ChangePassword } from './change-password';

export const dynamic = 'force-dynamic';

export default async function Account() {
  const me = (await currentUser())!;

  return (
    <>
      <PageHeader
        title="Your account"
        subtitle="Who you are signed in as, and how to change your password."
      />

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={me.fullName} size={52} />
            <div className="min-w-0">
              <p className="font-display font-extrabold text-lg truncate">{me.fullName}</p>
              <p className="text-support text-ink-soft truncate">{me.email}</p>
            </div>
          </div>

          <dl className="mt-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="label">Role</dt>
              <dd><Chip tone="info">{ROLE_LABEL[me.role]}</Chip></dd>
            </div>
            {me.department && (
              <div className="flex items-center justify-between gap-3">
                <dt className="label">Department</dt>
                <dd className="text-support">{me.department}</dd>
              </div>
            )}
            {me.staffNo && (
              <div className="flex items-center justify-between gap-3">
                <dt className="label">Staff number</dt>
                <dd className="val text-support">{me.staffNo}</dd>
              </div>
            )}
          </dl>

          <p className="text-chip text-ink-soft mt-5 leading-relaxed">
            Your role decides what you can reach, and only an administrator can
            change it. Every action you take is recorded against this name.
          </p>
        </Card>

        <Card title="Change your password">
          <p className="text-support text-ink-soft mb-5 max-w-md">
            If an administrator issued you a temporary password, replace it here.
            You need your current one, so that a session left open on a ward
            computer cannot be used to lock you out.
          </p>
          <ChangePassword />
        </Card>
      </div>
    </>
  );
}
