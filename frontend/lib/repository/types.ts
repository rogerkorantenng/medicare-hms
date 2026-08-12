/**
 * The single boundary between the UI and the database.
 *
 * The handoff's rule: "Keep the interface identical to what is described here,
 * then switch which implementation is constructed." No screen imports anything
 * below this line — they import `repo` from ./index and nothing else.
 */

export type Role =
  | 'patient' | 'doctor' | 'nurse' | 'receptionist'
  | 'lab' | 'radiology' | 'pharmacist' | 'cashier' | 'admin';

export type LabStatus = 'ordered' | 'collected' | 'processing' | 'resulted' | 'verified';
export type ImagingStatus = 'ordered' | 'scheduled' | 'scanned' | 'reported';
export type RxStatus = 'pending' | 'dispensed';
export type ApptStatus = 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
export type ClaimStatus = 'submitted' | 'authorised' | 'paid';
export type ResultFlag = 'normal' | 'high' | 'low' | 'critical';
export type Priority = 'routine' | 'stat';
export type Acuity = 'routine' | 'semi_urgent' | 'urgent';
export type MomoProvider = 'MTN MoMo' | 'Telecel Cash' | 'AT Money';

export interface Staff {
  id: string;
  staffNo: string;
  fullName: string;
  role: Role;
  department: string | null;
  onDuty: boolean;
}

export interface Patient {
  mrn: string;
  authUserId: string | null;
  fullName: string;
  age: number;
  sex: 'M' | 'F';
  phone: string;
  bloodGroup: string | null;
  allergies: string[];
  conditions: string[];
  insurance: string | null;
  lastVisit: string | null;
}

export interface NewPatient {
  fullName: string;
  age: number;
  sex: 'M' | 'F';
  phone: string;
  bloodGroup?: string | null;
  allergies?: string[];
  conditions?: string[];
  insurance?: string | null;
}

export interface Appointment {
  id: number;
  mrn: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  doctorDepartment?: string | null;
  specialty: string | null;
  apptDate: string;
  apptTime: string;
  apptType: string;
  status: ApptStatus;
}

export interface AppointmentFilter {
  /** Omitted for staff; the API forces a patient to their own record anyway. */
  mrn?: string;
  /** ISO date. Defaults to everything the API will return. */
  since?: string;
}

export interface NewAppointment {
  mrn: string;
  doctorId: string;
  specialty?: string | null;
  apptDate: string;
  apptTime: string;
  apptType?: string;
}

/** A patient waiting — in triage, or waiting for a named doctor. */
export interface QueueEntry {
  mrn: string;
  patientName: string;
  age: number;
  sex: 'M' | 'F';
  reason: string;
  waitingSince: string;
  acuity: Acuity | null;
  stage: 'waiting' | 'in_triage' | 'ready_for_doctor';
  appointmentId: number | null;
  doctorId: string | null;
  vitals: Vitals | null;
}

export interface Vitals {
  id: number;
  mrn: string;
  recordedBy: string;
  recordedByName?: string;
  systolic: number | null;
  diastolic: number | null;
  temperature: number | null;
  pulse: number | null;
  spo2: number | null;
  weightKg: number | null;
  acuity: Acuity | null;
  recordedAt: string;
}

export interface NewVitals {
  mrn: string;
  systolic?: number | null;
  diastolic?: number | null;
  temperature?: number | null;
  pulse?: number | null;
  spo2?: number | null;
  weightKg?: number | null;
  acuity?: Acuity | null;
}

export interface Encounter {
  id: number;
  mrn: string;
  doctorId: string;
  doctorName?: string;
  complaint: string;
  diagnosis: string;
  notes: string | null;
  aiAssisted: boolean;
  createdAt: string;
}

export interface StagedLab { testName: string; priority: Priority; price: number }
export interface StagedImaging { modality: string; bodyRegion: string; priority: Priority; price: number }
export interface StagedRx {
  drug: string; dose: string; frequency: string; duration: string; quantity: number;
}

export interface SignEncounterInput {
  mrn: string;
  complaint: string;
  diagnosis: string;
  notes?: string | null;
  aiAssisted?: boolean;
  labs?: StagedLab[];
  imaging?: StagedImaging[];
  prescriptions?: StagedRx[];
  admission?: { ward: string; bedNo: string } | null;
  referral?: { specialty: string } | null;
  followUpDays?: number | null;
  consultationFee?: number;
}

export interface LabOrder {
  id: number;
  mrn: string;
  patientName?: string;
  encounterId: number | null;
  orderedBy: string;
  orderedByName?: string;
  testName: string;
  priority: Priority;
  status: LabStatus;
  resultValue: string | null;
  refRange: string | null;
  flag: ResultFlag | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  price: number;
  createdAt: string;
}

export interface ResultInput {
  resultValue: string;
  refRange?: string | null;
  flag?: ResultFlag | null;
}

export interface ImagingOrder {
  id: number;
  mrn: string;
  patientName?: string;
  encounterId: number | null;
  orderedBy: string;
  modality: string;
  bodyRegion: string | null;
  priority: Priority;
  status: ImagingStatus;
  findings: string | null;
  reportedBy: string | null;
  price: number;
  createdAt: string;
}

export interface Prescription {
  id: number;
  mrn: string;
  patientName?: string;
  encounterId: number | null;
  prescriberId: string;
  prescriberName?: string;
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  status: RxStatus;
  dispensedBy: string | null;
  dispensedAt: string | null;
  createdAt: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  expiryDate: string | null;
  /** derived, so the pharmacy screen does not recompute it per row */
  lowStock: boolean;
  expiringSoon: boolean;
  expired: boolean;
}

export interface Bed {
  ward: string;
  bedNo: string;
  mrn: string | null;
  patientName: string | null;
  admittedAt: string | null;
}

export interface Ward {
  name: string;
  beds: Bed[];
  occupied: number;
  total: number;
}

/** One line of the medication round. */
export interface MarEntry {
  prescriptionId: number;
  mrn: string;
  patientName: string;
  ward: string;
  bedNo: string;
  drug: string;
  dose: string;
  frequency: string;
  lastGivenAt: string | null;
  dueNow: boolean;
}

export interface InvoiceLine {
  id: number;
  description: string;
  amount: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  mrn: string;
  patientName?: string;
  total: number;
  paid: number;
  status: 'paid' | 'part_paid' | 'unpaid';
  createdAt: string;
  lines: InvoiceLine[];
}

export interface Claim {
  id: string;
  invoiceId: string;
  insurer: string;
  amount: number;
  status: ClaimStatus;
  justification: string | null;
  updatedAt: string;
}

export interface ClinicalDocument {
  id: number;
  mrn: string;
  title: string;
  kind: string;
  body: string | null;
  docDate: string;
  createdBy: string | null;
}

export interface AuditEntry {
  id: number;
  staffId: string | null;
  actorName: string;
  action: string;
  target: string | null;
  occurredAt: string;
}

export interface AppNotification {
  id: number;
  mrn: string | null;
  staffId: string | null;
  kind: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Everything the six chart tabs need, in one call. */
export interface PatientChart {
  patient: Patient;
  encounters: Encounter[];
  vitals: Vitals[];
  labs: LabOrder[];
  imaging: ImagingOrder[];
  prescriptions: Prescription[];
  documents: ClinicalDocument[];
  invoices: Invoice[];
  bed: Bed | null;
}

export interface Kpis {
  patientsTotal: number;
  appointmentsToday: number;
  queueWaiting: number;
  bedsOccupied: number;
  bedsTotal: number;
  labsPending: number;
  imagingPending: number;
  rxPending: number;
  revenueCollected: number;
  revenueOutstanding: number;
  staffOnDuty: number;
  staffTotal: number;
  lowStockCount: number;
}

/** Assembled server-side and handed to the operations copilot as context. */
export interface OpsSnapshot {
  patientsTotal: number;
  wards: { name: string; occupied: number; total: number }[];
  queueWaiting: number;
  queueInTriage: number;
  labsPending: number;
  rxPending: number;
  revenueCollected: number;
  revenueOutstanding: number;
  staffOnDuty: number;
  staffTotal: number;
  claims: { submitted: number; authorised: number; paid: number };
}

export type SafetyResult =
  | { ok: true }
  | { ok: false; kind: 'allergy'; message: string }
  | { ok: false; kind: 'interaction'; message: string };

/**
 * The printable documents. Each is a record as it was stored, not a
 * reconstruction — a receipt reprinted next year must show what was
 * charged then.
 */
export interface PrescriptionSlip {
  id: number;
  mrn: string;
  patientName: string;
  age: number;
  sex: 'M' | 'F';
  allergies: string[];
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  prescriberName: string;
  staffNo: string | null;
  department: string | null;
}

export interface ReceiptDocument {
  id: string;
  mrn: string;
  patientName: string;
  total: number;
  paid: number;
  status: Invoice['status'];
  lines: { id: number; description: string; amount: number }[];
}

export interface DischargeSummary {
  id: number;
  mrn: string;
  patientName: string;
  age: number;
  sex: 'M' | 'F';
  title: string;
  kind: string;
  body: string | null;
  docDate: string;
}

export interface Repository {
  // ---- patients ----
  registerPatient(input: NewPatient): Promise<Patient>;
  searchPatients(query: string): Promise<Patient[]>;
  getPatient(mrn: string): Promise<Patient | null>;
  getPatientChart(mrn: string): Promise<PatientChart>;

  // ---- appointments and queue ----
  listAppointments(filter?: AppointmentFilter): Promise<Appointment[]>;
  freeSlots(doctorId: string, date: string): Promise<string[]>;
  bookAppointment(input: NewAppointment): Promise<Appointment>;
  checkIn(appointmentId: number): Promise<void>;
  addWalkIn(mrn: string): Promise<void>;
  triageQueue(): Promise<QueueEntry[]>;
  doctorQueue(doctorId: string): Promise<QueueEntry[]>;

  // ---- triage ----
  recordVitals(input: NewVitals): Promise<Vitals>;

  // ---- consultation ----
  signEncounter(input: SignEncounterInput): Promise<void>;
  checkPrescriptionSafety(mrn: string, drug: string): Promise<SafetyResult>;

  // ---- diagnostics ----
  labWorklist(): Promise<LabOrder[]>;
  advanceLabOrder(id: number, next: LabStatus, result?: ResultInput): Promise<void>;
  imagingWorklist(): Promise<ImagingOrder[]>;
  reportImaging(id: number, findings: string): Promise<void>;

  // ---- pharmacy ----
  pendingPrescriptions(): Promise<Prescription[]>;
  dispense(prescriptionId: number): Promise<void>;
  inventory(): Promise<InventoryItem[]>;

  // ---- wards ----
  wardBoard(): Promise<Ward[]>;
  admit(mrn: string, ward: string, bedNo: string): Promise<void>;
  discharge(ward: string, bedNo: string): Promise<void>;
  medicationRound(): Promise<MarEntry[]>;
  recordAdministration(prescriptionId: number): Promise<void>;

  // ---- billing ----
  invoices(): Promise<Invoice[]>;
  recordPayment(invoiceId: string, amount: number, method: 'cash' | 'momo',
                provider?: MomoProvider): Promise<void>;
  claims(): Promise<Claim[]>;
  advanceClaim(claimId: string): Promise<void>;

  // ---- admin ----
  dashboardKpis(): Promise<Kpis>;
  liveActivity(limit: number): Promise<AuditEntry[]>;
  staffDirectory(): Promise<Staff[]>;
  /** Doctors on duty, for the booking screens. Readable by a patient. */
  bookableDoctors(): Promise<Staff[]>;
  hospitalSnapshot(): Promise<OpsSnapshot>;

  // ---- notifications ----
  notifications(): Promise<AppNotification[]>;
  markRead(id: number): Promise<void>;

  // ---- printable documents ----
  prescriptionSlip(id: number): Promise<PrescriptionSlip | null>;
  receipt(invoiceId: string): Promise<ReceiptDocument | null>;
  dischargeSummary(id: number): Promise<DischargeSummary | null>;
}
