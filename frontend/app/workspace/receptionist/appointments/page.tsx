import { repo } from '@/lib/repository';
import { PageHeader, Card, EmptyState, StatusChip, onlyDate } from '@/components/ui';
import { BookingPanel } from './booking-panel';
import { AppointmentActions } from './appointment-actions';

export const dynamic = 'force-dynamic';

export default async function Appointments() {
  const [appts, staff] = await Promise.all([
    repo.listAppointments({ since: new Date().toISOString().slice(0, 10) }),
    repo.staffDirectory(),
  ]);

  const doctors = staff.filter((s) => s.role === 'doctor');

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Slots already taken are struck through and cannot be selected. The database refuses a double booking even if two desks try at once."
      />

      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-5">
        <Card title="Schedule">
          {appts.length === 0 ? (
            <EmptyState icon="event" title="Nothing booked" />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[1020px] text-body">
                <thead>
                  <tr>
                    <th className="th pl-5">Date</th>
                    <th className="th">Time</th>
                    <th className="th">Patient</th>
                    <th className="th">Doctor</th>
                    <th className="th">Type</th>
                    <th className="th">Status</th>
                    <th className="th pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => (
                    <tr key={a.id} className="row-hover">
                      <td className="td pl-5 val text-support">{onlyDate(a.apptDate)}</td>
                      <td className="td val font-bold">{a.apptTime.slice(0, 5)}</td>
                      <td className="td">
                        <p className="font-display font-semibold">{a.patientName}</p>
                        <p className="val text-chip text-ink-soft">{a.mrn}</p>
                      </td>
                      <td className="td">
                        <p>{a.doctorName}</p>
                        <p className="text-chip text-ink-soft">{a.specialty ?? a.doctorDepartment}</p>
                      </td>
                      <td className="td text-ink-soft">{a.apptType}</td>
                      <td className="td"><StatusChip value={a.status} /></td>
                      <td className="td pr-5"><AppointmentActions appointment={a} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <BookingPanel doctors={doctors} />
      </div>
    </>
  );
}
