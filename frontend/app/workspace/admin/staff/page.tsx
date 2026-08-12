import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/session';
import { PageHeader, Card, Avatar, Chip, Stat } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/nav';
import { AddStaff } from './add-staff';
import { StaffRowActions } from './row-actions';

export const dynamic = 'force-dynamic';

export default async function StaffDirectory() {
  const [staff, me] = await Promise.all([repo.staffDirectory(), currentUser()]);

  const active = staff.filter((s) => s.isActive !== false);
  const onDuty = active.filter((s) => s.onDuty);
  const departments = new Set(active.map((s) => s.department).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Accounts, roles and duty. Creating an account here is what gives somebody access to the system."
        action={<AddStaff />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Active accounts" icon="groups" value={active.length} />
        <Stat label="On duty" icon="how_to_reg" value={onDuty.length} tone="success" />
        <Stat label="Off duty" icon="block" value={active.length - onDuty.length} />
        <Stat label="Departments" icon="badge" value={departments} />
      </div>

      <Card>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[900px] text-body">
            <thead>
              <tr>
                <th className="th pl-5">Name</th>
                <th className="th">Staff no.</th>
                <th className="th">Role</th>
                <th className="th">Department</th>
                <th className="th">Duty</th>
                <th className="th pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const inactive = s.isActive === false;
                return (
                  <tr key={s.id} className={`row-hover ${inactive ? 'opacity-55' : ''}`}>
                    <td className="td pl-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.fullName} size={32} />
                        <div className="min-w-0">
                          <p className="font-display font-semibold truncate">{s.fullName}</p>
                          {s.email && (
                            <p className="text-chip text-ink-soft truncate">{s.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="td val text-ink-soft">{s.staffNo}</td>
                    <td className="td">{ROLE_LABEL[s.role]}</td>
                    <td className="td text-ink-soft">{s.department ?? '—'}</td>
                    <td className="td">
                      {inactive
                        ? <Chip tone="danger">Deactivated</Chip>
                        : s.onDuty
                          ? <Chip tone="success">On duty</Chip>
                          : <Chip tone="neutral">Off duty</Chip>}
                    </td>
                    <td className="td pr-5">
                      <StaffRowActions member={s} isSelf={s.id === me?.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-support text-ink-soft mt-4 max-w-2xl">
        Nobody is ever deleted. Orders, prescriptions and audit entries name
        the person who performed them, so a removed record would break the
        trail. Deactivating blocks sign-in and clears the password while
        leaving every reference intact.
      </p>
    </>
  );
}
