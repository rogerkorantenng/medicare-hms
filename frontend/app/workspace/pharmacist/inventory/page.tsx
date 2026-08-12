import { repo } from '@/lib/repository';
import { PageHeader, Card, Chip, Stat, money, onlyDate } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Inventory() {
  const items = await repo.inventory();
  const low = items.filter((i) => i.lowStock);
  const expiring = items.filter((i) => i.expiringSoon || i.expired);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock levels, reorder points and expiry." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Items" value={items.length} />
        <Stat label="Below reorder level" value={low.length} tone={low.length ? 'danger' : undefined} />
        <Stat label="Expiring or expired" value={expiring.length} tone={expiring.length ? 'warning' : undefined} />
        <Stat
          label="Stock value"
          value={money(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))}
        />
      </div>

      <Card title="All stock">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[820px] text-body">
            <thead>
              <tr>
                <th className="th pl-5">Item</th>
                <th className="th">Category</th>
                <th className="th text-right">On hand</th>
                <th className="th text-right">Reorder at</th>
                <th className="th text-right">Unit price</th>
                <th className="th">Expiry</th>
                <th className="th pr-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="row-hover">
                  <td className="td pl-5 font-display font-semibold">{i.name}</td>
                  <td className="td text-ink-soft">{i.category ?? '—'}</td>
                  <td className="td val text-right">{i.quantity}</td>
                  <td className="td val text-right text-ink-soft">{i.reorderLevel}</td>
                  <td className="td val text-right">{money(i.unitPrice)}</td>
                  <td className="td val text-support">{onlyDate(i.expiryDate)}</td>
                  <td className="td pr-5">
                    <div className="flex flex-wrap gap-1.5">
                      {i.lowStock && <Chip tone="danger" icon="trending_down">Low stock</Chip>}
                      {i.expired && <Chip tone="danger" icon="event_busy">Expired</Chip>}
                      {i.expiringSoon && <Chip tone="warning" icon="schedule">Expiring soon</Chip>}
                      {!i.lowStock && !i.expired && !i.expiringSoon && <Chip tone="success">In stock</Chip>}
                    </div>
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
