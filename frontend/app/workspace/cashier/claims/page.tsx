import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, StatusChip, money, when } from '@/components/ui';
import { ClaimRow } from './claim-row';

export const dynamic = 'force-dynamic';

/** Advance submitted to authorised to paid. Forward only — the trigger refuses anything else. */
export default async function Claims() {
  const claims = await repo.claims();

  return (
    <>
      <PageHeader
        title="Insurance claims"
        subtitle="Claims move forward only. The database refuses a status that goes backwards."
      />

      {claims.length === 0 ? (
        <Card><EmptyState icon="health_metrics" title="No claims raised" /></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {claims.map((c) => <ClaimRow key={c.id} claim={c} />)}
        </div>
      )}
    </>
  );
}
