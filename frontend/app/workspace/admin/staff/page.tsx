import { repo } from '@/lib/repository';
import { PageHeader, Card, Avatar, Chip, Stat } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/nav';

export const dynamic = 'force-dynamic';

export default async function StaffDirectory() {
  const staff = await repo.staffDirectory();
  const onDuty = staff.filter((s) => s.onDuty);

  return (
    <>
      <PageHeader title="Staff" subtitle="Directory with role, department and duty status." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Staff" value={staff.length} />
        <Stat label="On duty" value={onDuty.length} tone="success" />
        <Stat label="Off duty" value={staff.length - onDuty.length} />
        <Stat label="Departments" value={new Set(staff.map((s) => s.department).filter(Boolean)).size} />
      </div>

      <Card>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[680px] text-body">
            <thead>
              <tr>
                <th className="th pl-5">Name</th>
                <th className="th">Staff no.</th>
                <th className="th">Role</th>
                <th className="th">Department</th>
                <th className="th pr-5">Duty</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="row-hover">
                  <td className="td pl-5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.fullName} size={32} />
                      <span className="font-display font-semibold">{s.fullName}</span>
                    </div>
                  </td>
                  <td className="td val text-ink-soft">{s.staffNo}</td>
                  <td className="td">{ROLE_LABEL[s.role]}</td>
                  <td className="td text-ink-soft">{s.department ?? '—'}</td>
                  <td className="td pr-5">
                    {s.onDuty ? <Chip tone="success">On duty</Chip> : <Chip tone="neutral">Off duty</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
