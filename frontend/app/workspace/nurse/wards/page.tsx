import { repo } from '@/lib/repository';
import { PageHeader, Card, Stat } from '@/components/ui';
import { BedTile } from './bed-tile';
import { WardAdmin, BedActions } from './ward-admin';

export const dynamic = 'force-dynamic';

/** Six wards, 34 beds. Discharge frees the bed and writes the summary. */
export default async function Wards() {
  const wards = await repo.wardBoard();
  const occupied = wards.reduce((s, w) => s + w.occupied, 0);
  const total = wards.reduce((s, w) => s + w.total, 0);

  return (
    <>
      <PageHeader
        action={<WardAdmin wards={wards.map((w) => w.name)} />}
        title="Wards and beds"
        subtitle="Discharging frees the bed and writes the discharge summary in one action."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Beds occupied" icon="bed" value={`${occupied} / ${total}`} />
        <Stat label="Free beds" icon="check_circle" value={total - occupied} tone="success" />
        <Stat label="Wards" icon="home" value={wards.length} />
        <Stat label="Occupancy" icon="monitor_heart" value={`${total ? Math.round((occupied / total) * 100) : 0}%`} />
      </div>

      <div className="flex flex-col gap-5">
        {wards.map((w) => (
          <Card
            key={w.name}
            title={w.name}
            action={
              <span className="val text-support text-ink-soft">
                {w.occupied} of {w.total} occupied
              </span>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {w.beds.map((b) => (
                <div key={b.bedNo} className="flex flex-col gap-1">
                  <BedTile bed={b} />
                  <div className="flex justify-end">
                    <BedActions bed={b} wards={wards.map((x) => x.name)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
