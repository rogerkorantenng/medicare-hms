import { repo } from '@/lib/repository';
import { AlertsList } from './alerts-list';

export const dynamic = 'force-dynamic';

export default async function Alerts() {
  const notifications = await repo.notifications();

  return (
    <>
      <header className="pt-[62px] px-5 pb-4 bg-white border-b border-hairline md:pt-8 md:px-8">
        <h1 className="text-title">Alerts</h1>
      </header>
      <AlertsList initial={notifications} />
    </>
  );
}
