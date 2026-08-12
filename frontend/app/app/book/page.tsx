import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/supabase/server';
import { BookFlow } from './book-flow';

export const dynamic = 'force-dynamic';

export default async function Book({ searchParams }: { searchParams: { specialty?: string } }) {
  const [me, staff] = await Promise.all([currentUser(), repo.staffDirectory()]);
  const doctors = staff.filter((s) => s.role === 'doctor' && s.onDuty);

  return (
    <>
      <header className="pt-[62px] px-5 pb-4 bg-white border-b border-hairline">
        <h1 className="text-title">Book an appointment</h1>
        <p className="text-m-support text-ink-soft mt-0.5">
          Slots already taken are struck through and cannot be chosen.
        </p>
      </header>

      <BookFlow doctors={doctors} mrn={me!.mrn!} preferredSpecialty={searchParams.specialty ?? null} />
    </>
  );
}
