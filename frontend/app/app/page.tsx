import Link from 'next/link';
import { repo } from '@/lib/repository';
import { currentUser, supabaseServer } from '@/lib/supabase/server';
import { Icon, Avatar, Chip, onlyDate } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** Next appointment hero, four quick actions, symptom-checker banner, active medications. */
export default async function PatientHome() {
  const me = await currentUser();
  const db = supabaseServer();

  const [{ data: appts }, chart] = await Promise.all([
    db.from('appointments')
      .select('*, staff:doctor_id(full_name, department)')
      .gte('appt_date', new Date().toISOString().slice(0, 10))
      .in('status', ['confirmed', 'checked_in'])
      .order('appt_date').order('appt_time').limit(1),
    me!.mrn ? repo.getPatientChart(me!.mrn) : null,
  ]);

  const next = appts?.[0];
  const meds = (chart?.prescriptions ?? []).filter((r) => r.status === 'pending');
  const firstName = me!.fullName.split(' ')[0];

  return (
    <>
      {/* 62px top inset for the status bar. */}
      <header className="pt-[62px] px-5 pb-5 bg-gradient-to-br from-primary-bright to-primary-deep text-white rounded-b-sheet">
        <div className="flex items-center gap-3">
          <Avatar name={me!.fullName} size={44} />
          <div className="min-w-0">
            <p className="text-m-support text-white/70">Good day</p>
            <p className="font-display font-extrabold text-lg truncate">{firstName}</p>
          </div>
          <Link
            href="/app/alerts"
            className="ml-auto grid place-items-center w-11 h-11 rounded-full bg-white/15"
            aria-label="Alerts"
          >
            <Icon name="notifications" size={21} />
          </Link>
        </div>

        {/* Next appointment hero */}
        <div className="mt-5 rounded-card bg-white/15 backdrop-blur p-4">
          {next ? (
            <>
              <p className="text-m-chip uppercase tracking-wider text-white/70 font-bold">Next appointment</p>
              <p className="font-display font-extrabold text-lg mt-1">
                {next.staff?.full_name}
              </p>
              <p className="text-m-support text-white/80">{next.specialty ?? next.staff?.department}</p>
              <div className="flex items-center gap-3 mt-3 text-m-support">
                <span className="flex items-center gap-1.5">
                  <Icon name="event" size={16} />
                  <span className="val">{onlyDate(next.appt_date)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="schedule" size={16} />
                  <span className="val">{String(next.appt_time).slice(0, 5)}</span>
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="font-display font-extrabold">No upcoming appointment</p>
              <p className="text-m-support text-white/80 mt-1">Book one whenever you need to be seen.</p>
              <Link href="/app/book" className="btn bg-white text-primary mt-3 w-full">Book now</Link>
            </>
          )}
        </div>
      </header>

      <div className="px-5 mt-5 flex flex-col gap-5">
        {/* Quick actions — 44px minimum targets */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { href: '/app/book', icon: 'event_available', label: 'Book' },
            { href: '/app/records', icon: 'lab_profile', label: 'Results' },
            { href: '/app/records?tab=bills', icon: 'payments', label: 'Bills' },
            { href: '/app/symptom-checker', icon: 'chat', label: 'Symptoms' },
          ].map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex flex-col items-center gap-1.5 rounded-card bg-white border border-hairline py-3 min-h-[76px] justify-center"
            >
              <span className="grid place-items-center w-9 h-9 rounded-full bg-primary-tint text-primary">
                <Icon name={a.icon} size={19} />
              </span>
              <span className="text-m-chip font-display font-bold">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Symptom checker banner */}
        <Link
          href="/app/symptom-checker"
          className="rounded-card border border-ai-br bg-ai-bg p-4 flex items-center gap-3"
        >
          <span className="grid place-items-center w-11 h-11 rounded-full bg-white text-ai-fg shrink-0">
            <Icon name="auto_awesome" size={21} filled />
          </span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-ai-fg">Not sure who to see?</p>
            <p className="text-m-support text-ai-fg/80">
              Describe your symptoms and get pointed to the right specialty.
            </p>
          </div>
          <Icon name="arrow_forward" size={19} className="text-ai-fg ml-auto shrink-0" />
        </Link>

        {/* Active medications */}
        <section>
          <h2 className="text-m-section mb-2.5">Your medications</h2>
          {meds.length === 0 ? (
            <p className="rounded-card bg-white border border-hairline p-4 text-m-support text-ink-soft">
              Nothing active at the moment.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {meds.map((m) => (
                <li key={m.id} className="rounded-card bg-white border border-hairline p-4 flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-primary-tint text-primary shrink-0">
                    <Icon name="pill" size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold truncate">{m.drug}</p>
                    <p className="text-m-support text-ink-soft">{m.dose} · {m.frequency}</p>
                  </div>
                  <Chip tone="warning">To collect</Chip>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Emergency */}
        <a
          href="tel:193"
          className="rounded-card border border-danger-br bg-danger-bg p-4 flex items-center gap-3 min-h-[64px]"
        >
          <span className="grid place-items-center w-11 h-11 rounded-full bg-danger-fg text-white shrink-0">
            <Icon name="e911_emergency" size={21} filled />
          </span>
          <div>
            <p className="font-display font-extrabold text-danger-fg">Emergency</p>
            <p className="text-m-support text-danger-fg/80">Call the emergency line now</p>
          </div>
        </a>
      </div>
    </>
  );
}
