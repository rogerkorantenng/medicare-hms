# Repository contract

The single boundary between the UI and its storage. In v1.0 this interface was
satisfied by a browser-storage adapter. Implement it against anything else and
the UI does not care which one it is talking to. It is now satisfied by an HTTP
client against the FastAPI service.

**This is migration steps 3 and 4.** Keep the interface identical to what is
described here, then switch which implementation is constructed. That is the whole
switch — one line.

```ts
// lib/repository/types.ts

export interface Repository {
  // ---- patients ----
  registerPatient(input: NewPatient): Promise<Patient>;          // MRN allocated by the DB
  searchPatients(query: string): Promise<Patient[]>;             // name or MRN, as-you-type
  getPatient(mrn: string): Promise<Patient | null>;
  getPatientChart(mrn: string): Promise<PatientChart>;           // all six tabs in one call

  // ---- appointments and queue ----
  freeSlots(doctorId: string, date: string): Promise<string[]>;  // MUST exclude booked
  bookAppointment(input: NewAppointment): Promise<Appointment>;
  checkIn(appointmentId: number): Promise<void>;                 // -> triage queue
  addWalkIn(mrn: string): Promise<void>;
  triageQueue(): Promise<QueueEntry[]>;
  doctorQueue(doctorId: string): Promise<QueueEntry[]>;

  // ---- triage ----
  recordVitals(input: NewVitals): Promise<Vitals>;               // DB rejects implausible

  // ---- consultation ----
  signEncounter(input: SignEncounterInput): Promise<void>;        // atomic, see below
  checkPrescriptionSafety(mrn: string, drug: string): Promise<SafetyResult>;

  // ---- diagnostics ----
  labWorklist(): Promise<LabOrder[]>;                            // STAT first
  advanceLabOrder(id: number, next: LabStatus, result?: ResultInput): Promise<void>;
  imagingWorklist(): Promise<ImagingOrder[]>;
  reportImaging(id: number, findings: string): Promise<void>;

  // ---- pharmacy ----
  pendingPrescriptions(): Promise<Prescription[]>;
  dispense(prescriptionId: number): Promise<void>;               // calls the DB function
  inventory(): Promise<InventoryItem[]>;                         // with low-stock/expiry flags

  // ---- wards ----
  wardBoard(): Promise<Ward[]>;
  admit(mrn: string, ward: string, bedNo: string): Promise<void>;
  discharge(ward: string, bedNo: string): Promise<void>;         // frees bed + writes summary
  medicationRound(): Promise<MarEntry[]>;
  recordAdministration(prescriptionId: number): Promise<void>;

  // ---- billing ----
  invoices(): Promise<Invoice[]>;
  recordPayment(invoiceId: string, amount: number, method: 'cash' | 'momo',
                provider?: MomoProvider): Promise<void>;
  claims(): Promise<Claim[]>;
  advanceClaim(claimId: string): Promise<void>;                  // forward only

  // ---- admin ----
  dashboardKpis(): Promise<Kpis>;
  liveActivity(limit: number): Promise<AuditEntry[]>;
  staffDirectory(): Promise<Staff[]>;
  hospitalSnapshot(): Promise<OpsSnapshot>;                      // input for the ops copilot

  // ---- notifications ----
  notifications(): Promise<Notification[]>;
  markRead(id: number): Promise<void>;
}
```

## Construction point — migration step 4

```ts
// lib/repository/index.ts
import { HttpRepository } from './http';

export const repo: Repository = new HttpRepository();
// The ONLY line that changes when swapping storage. No screen imports
// anything else.
```

## Behaviour that must be preserved exactly

### signEncounter is atomic

One consultation signing stages a laboratory order, a prescription, an invoice
line, a timeline entry and possibly a referral, an admission and a follow-up. All
of it commits or none of it does. Implement as a single Postgres function called
through `rpc()`, not as a sequence of client-side inserts.

```
signEncounter(input) must, in one transaction:
  1. insert the encounter          (DB rejects an empty diagnosis)
  2. insert each staged lab order  -> status 'ordered'
  3. insert each staged imaging    -> status 'ordered'
  4. insert each staged prescription -> status 'pending'
  5. if admission staged, mark the ward bed
  6. if referral staged, create a queue entry for the receiving specialty
  7. if follow-up staged, create the appointment N days ahead
  8. add the consultation fee invoice line
  9. write the audit entry
 10. clear the patient from the doctor's queue
```

### checkPrescriptionSafety is deterministic, never AI

```ts
type SafetyResult =
  | { ok: true }
  | { ok: false; kind: 'allergy';     message: string }
  | { ok: false; kind: 'interaction'; message: string };
```

Rules, evaluated in this order, from the patient's `allergies` array and their
non-dispensed prescriptions:

| Check | Trigger | Message shape |
|---|---|---|
| Allergy | Drug belongs to a class the patient is allergic to | `ALLERGY ALERT — <name> is allergic to <allergen>. <drug> is contraindicated.` |
| Interaction | Warfarin + any NSAID | `INTERACTION — Major bleed risk. NSAID with anticoagulant.` |
| Interaction | Two RAAS agents, e.g. Lisinopril + Losartan | `INTERACTION — Two RAAS agents. Risk of hyperkalaemia and hypotension.` |
| Duplicate | Same active ingredient already active | `INTERACTION — Duplicate therapy.` |

Allergy classes to carry over from v1.0:

```ts
const ALLERGY_CLASSES: Record<string, string[]> = {
  Penicillin: ['Amoxicillin', 'Penicillin', 'Ampicillin', 'Flucloxacillin'],
  Sulfa:      ['Sulfamethoxazole', 'Co-trimoxazole'],
  NSAID:      ['Ibuprofen', 'Diclofenac', 'Naproxen'],
};
```

A blocked prescription **cannot be forced through from the screen**. Do not add an
override button. The submitted user manual states that a clinician who judges the
drug necessary despite the conflict must handle it with the pharmacist directly.

### freeSlots must exclude existing bookings

Defect D-03 was caused by reading the roster and ignoring bookings already made.
Query both. Booked slots render struck through and are not selectable.

```sql
select s.slot from unnest(array[
  '09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00','15:30','16:00'
]) as s(slot)
where not exists (
  select 1 from appointments a
   where a.doctor_id = $1 and a.appt_date = $2
     and a.appt_time = s.slot::time
     and a.status in ('confirmed','checked_in')
);
```

### advanceLabOrder passes only the next stage

The database trigger refuses a skip. The UI should offer only the next legal
action so the error cannot be reached in normal use. Verification requires a
result value, and release fires on verification alone.

### dispense calls the database function

```ts
// The route calls the database function; the client never does arithmetic.
await call(`/pharmacy/prescriptions/${id}/dispense`, { method: 'POST' });
```

Do not read stock, subtract in JavaScript and write it back. That was defect D-05.

### recordPayment for Mobile Money

The provider sequence is: select provider, enter wallet number, send request,
patient approves with PIN, record payment. In v1.0 the gateway step is modelled.
When wiring a real provider, replace only that step. The audit entry must name the
provider:

```
Payment recorded (MoMo · MTN MoMo) INV-2100
```
