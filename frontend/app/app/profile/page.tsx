import { repo } from '@/lib/repository';
import { currentUser } from '@/lib/session';
import { Icon, Avatar, Chip } from '@/components/ui';
import { SignOutButton } from './sign-out';
import { NotifySwitches } from './notify-switches';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const me = await currentUser();
  const [patient, prefs] = await Promise.all([
    me!.mrn ? repo.getPatient(me!.mrn) : null,
    repo.notificationPreferences(),
  ]);

  return (
    <>
      <header className="pt-[62px] px-5 pb-6 bg-gradient-to-br from-primary-bright to-primary-deep text-white rounded-b-sheet text-center md:pt-8 md:mx-8 md:mt-8 md:rounded-card">
        <Avatar name={me!.fullName} size={72} />
        <h1 className="font-display font-extrabold text-xl mt-3">{me!.fullName}</h1>
        <p className="val text-m-support text-white/75 mt-0.5">{patient?.mrn}</p>
      </header>

      <div className="px-5 md:px-8 py-5 flex flex-col gap-5">
        <section className="rounded-card bg-white border border-hairline p-4">
          <h2 className="text-m-section mb-3">Your details</h2>
          <dl className="flex flex-col gap-3">
            {[
              ['Phone', patient?.phone, 'call'],
              ['Age', patient ? `${patient.age}` : null, 'cake'],
              ['Blood group', patient?.bloodGroup, 'water_drop'],
              ['Insurance', patient?.insurance, 'health_metrics'],
            ].map(([label, value, icon]) => (
              <div key={String(label)} className="flex items-center gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-primary-tint text-primary shrink-0">
                  <Icon name={String(icon)} size={17} />
                </span>
                <dt className="text-m-support text-ink-soft flex-1">{label}</dt>
                <dd className="val text-m-body font-semibold">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-card bg-white border border-hairline p-4">
          <h2 className="text-m-section mb-3">Allergies</h2>
          {!patient?.allergies.length ? (
            <Chip tone="success">No known allergies</Chip>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {patient.allergies.map((a) => <Chip key={a} tone="danger" icon="warning">{a}</Chip>)}
            </div>
          )}
          <p className="text-m-support text-ink-soft mt-3">
            Your care team checks these automatically before any medicine is prescribed
            to you. Tell reception if anything here is wrong.
          </p>
        </section>

        {!!patient?.conditions.length && (
          <section className="rounded-card bg-white border border-hairline p-4">
            <h2 className="text-m-section mb-3">Conditions on record</h2>
            <div className="flex flex-wrap gap-1.5">
              {patient.conditions.map((c) => <Chip key={c} tone="info">{c}</Chip>)}
            </div>
          </section>
        )}

        <section className="rounded-card bg-white border border-hairline p-4">
          <h2 className="text-m-section mb-1">Notifications</h2>
          <p className="text-m-support text-ink-soft mb-2">
            Results are released to you only after the laboratory has verified
            them, whatever you choose here.
          </p>
          <NotifySwitches initial={prefs} />
        </section>

        <SignOutButton />

        <p className="text-m-support text-ink-faint text-center">
          All data in this application is synthetic. No real patient data appears anywhere.
        </p>
      </div>
    </>
  );
}
