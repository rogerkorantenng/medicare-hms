import Link from 'next/link';
import { repo } from '@/lib/repository';
import { PageHeader, Card, Avatar, Chip, EmptyState, onlyDate } from '@/components/ui';
import { ListFilter } from '@/components/list-filter';

export const dynamic = 'force-dynamic';

export default async function Patients({
  searchParams,
}: { searchParams: { q?: string; offset?: string; limit?: string } }) {
  const q = searchParams.q ?? '';
  const offset = Number(searchParams.offset ?? 0);
  const limit = Number(searchParams.limit ?? 50);
  const patients = await repo.searchPatients(q, limit, offset);
  // The count comes back on every row, so paging needs no second query.
  const total = patients[0]?.totalMatching ?? patients.length;

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${total} record${total === 1 ? '' : 's'}${q ? ` matching "${q}"` : ''}`}
      />

      <ListFilter placeholder="Name, MRN or phone number" total={total} />

      {patients.length === 0 ? (
        <Card><EmptyState icon="search_off" title="No patient matches that" /></Card>
      ) : (
        <Card>
          <ul className="flex flex-col gap-2">
            {patients.map((p) => (
              <li key={p.mrn}>
                <Link
                  href={`/workspace/patients/${p.mrn}`}
                  className="flex flex-wrap items-center gap-3 rounded-row border border-hairline p-3.5 row-hover"
                >
                  <Avatar name={p.fullName} />
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-display font-bold">{p.fullName}</p>
                    <p className="text-support text-ink-soft">
                      <span className="val">{p.mrn}</span> · {p.age}{p.sex} · <span className="val">{p.phone}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.allergies.map((a) => <Chip key={a} tone="danger" icon="warning">{a}</Chip>)}
                    {p.conditions.map((c) => <Chip key={c} tone="info">{c}</Chip>)}
                  </div>
                  <span className="val text-support text-ink-soft ml-auto">
                    Last seen {onlyDate(p.lastVisit)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
