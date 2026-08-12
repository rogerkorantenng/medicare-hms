import { repo } from '@/lib/repository';
import { PageHeader, Card, Icon, when } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Every action, actor, target and timestamp.
 *
 * There is deliberately no edit control and no delete control on this screen,
 * because there is none in the database either: no update policy and no delete
 * policy exists on audit_entries for any role, and the grants are revoked. An
 * audit trail that can be edited is not an audit trail.
 */
export default async function AuditLog() {
  const entries = await repo.liveActivity(300);

  return (
    <>
      <PageHeader title="Audit log" subtitle={`${entries.length} most recent entries, newest first.`} />

      <div className="mb-5 rounded-card border border-info-br bg-info-bg px-4 py-3 flex items-start gap-2.5">
        <Icon name="lock" size={19} className="text-info-fg mt-0.5" />
        <p className="text-support text-info-fg">
          Append-only. No update or delete policy exists on this table for any role,
          including an administrator, and the grants are revoked at the database level.
          Nobody can alter history through this or any other interface.
        </p>
      </div>

      <Card>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[720px] text-body">
            <thead>
              <tr>
                <th className="th pl-5">When</th>
                <th className="th">Actor</th>
                <th className="th">Action</th>
                <th className="th pr-5">Target</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((a) => (
                <tr key={a.id} className="row-hover">
                  <td className="td pl-5 val text-support text-ink-soft whitespace-nowrap">{when(a.occurredAt)}</td>
                  <td className="td font-display font-semibold">{a.actorName}</td>
                  <td className="td">{a.action}</td>
                  <td className="td pr-5 text-ink-soft">{a.target ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
