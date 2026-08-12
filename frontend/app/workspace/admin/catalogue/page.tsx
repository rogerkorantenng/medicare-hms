import { repo } from '@/lib/repository';
import { PageHeader, Card, Chip, money } from '@/components/ui';
import { AddCatalogueItem, CatalogueRow } from './catalogue-actions';

export const dynamic = 'force-dynamic';

const GROUPS = [
  { kind: 'lab' as const, title: 'Laboratory tests',
    note: 'What a doctor can order, and what it costs.' },
  { kind: 'imaging' as const, title: 'Imaging studies',
    note: 'Modality and body region, priced separately.' },
  { kind: 'tariff' as const, title: 'Tariff',
    note: 'Consultation fees and anything charged by hand.' },
];

/**
 * These three lists used to be TypeScript arrays. Repricing a test meant
 * a code change and a redeploy, by somebody who had no business setting
 * prices. A hospital reprices far more often than it redeploys.
 */
export default async function Catalogue() {
  const items = await repo.catalogue();

  return (
    <>
      <PageHeader
        title="Catalogue"
        subtitle="Tests, studies and fees. Changing a price here changes what the consultation screen offers, with no redeploy."
        action={<AddCatalogueItem />}
      />

      <div className="flex flex-col gap-5">
        {GROUPS.map((group) => {
          const rows = items.filter((i) => i.kind === group.kind);
          return (
            <Card key={group.kind} title={`${group.title} · ${rows.length}`}>
              <p className="text-support text-ink-soft -mt-2 mb-4">{group.note}</p>
              <div className="overflow-x-auto -mx-5">
                <table className="w-full min-w-[640px] text-body">
                  <thead>
                    <tr>
                      <th className="th pl-5">Name</th>
                      {group.kind === 'imaging' && <th className="th">Region</th>}
                      <th className="th text-right">Price</th>
                      <th className="th">Status</th>
                      <th className="th pr-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id} className={`row-hover ${item.isActive ? '' : 'opacity-55'}`}>
                        <td className="td pl-5 font-display font-semibold">{item.name}</td>
                        {group.kind === 'imaging' && (
                          <td className="td text-ink-soft">{item.bodyRegion ?? '—'}</td>
                        )}
                        <td className="td val text-right">{money(item.price)}</td>
                        <td className="td">
                          {item.isActive
                            ? <Chip tone="success">In use</Chip>
                            : <Chip tone="neutral">Retired</Chip>}
                        </td>
                        <td className="td pr-5"><CatalogueRow item={item} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-support text-ink-soft mt-4 max-w-2xl">
        Retiring an entry hides it from new orders and leaves past ones alone.
        Nothing is deleted, because an invoice line names what was ordered and
        a price that changed must not rewrite what somebody was already charged.
      </p>
    </>
  );
}
