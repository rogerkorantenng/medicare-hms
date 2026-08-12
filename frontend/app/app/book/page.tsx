import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/session';
import { BookFlow } from './book-flow';

export const dynamic = 'force-dynamic';

export default async function Book({ searchParams }: { searchParams: { specialty?: string } }) {
  // Not the staff directory: a patient chooses a doctor without being able
  // to enumerate the hospital's staff.
  const [me, doctors] = await Promise.all([currentUser(), repo.bookableDoctors()]);

  return (
    <>
      <header className="pt-[62px] px-5 pb-4 bg-white border-b border-hairline md:pt-8 md:px-8">
        <h1 className="text-title">Book an appointment</h1>
        <p className="text-m-support text-ink-soft mt-0.5">
          Slots already taken are struck through and cannot be chosen.
        </p>
      </header>

      <BookFlow doctors={doctors} mrn={me!.mrn!} preferredSpecialty={searchParams.specialty ?? null} />
    </>
  );
}
