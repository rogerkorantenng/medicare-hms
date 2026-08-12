import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/session';
import { RecordTabs } from './record-tabs';

export const dynamic = 'force-dynamic';

/** Three tabs: results with flags and an explain button, meds, bills with pay. */
export default async function Records({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await currentUser();
  const chart = await repo.getPatientChart(me!.mrn!);

  return (
    <>
      <header className="pt-[62px] px-5 pb-4 bg-white border-b border-hairline md:pt-8 md:px-8">
        <h1 className="text-title">Your records</h1>
        <p className="text-m-support text-ink-soft mt-0.5">
          Results appear here once the laboratory has verified them.
        </p>
      </header>

      <RecordTabs chart={chart} initialTab={searchParams.tab ?? 'results'} />
    </>
  );
}
