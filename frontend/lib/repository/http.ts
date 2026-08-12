import { call } from '@/lib/api/client';
import type {
  Repository, Patient, NewPatient, PatientChart, Appointment, NewAppointment,
  QueueEntry, Vitals, NewVitals, SignEncounterInput, SafetyResult, LabOrder,
  LabStatus, ResultInput, ImagingOrder, Prescription, InventoryItem, Ward,
  MarEntry, Invoice, Claim, Kpis, AuditEntry, Staff, OpsSnapshot, AppNotification,
  MomoProvider, AppointmentFilter, PrescriptionSlip, ReceiptDocument, DischargeSummary,
  NewStaff, StaffPatch, PatientDemographics, ClinicalFacts, NotifyPrefs,
  CatalogueItem, NewCatalogueItem, NewInventoryItem, InventoryPatch, StockMovement,
  Shift, LeaveEntry, Roster, PaymentEntry, Summary, StaffMessage, PortalAccess,
  Bed, ClinicalDocument, Acuity,
} from './types';

/**
 * The Repository, implemented over HTTP against the FastAPI backend.
 *
 * The interface is unchanged from the one the submitted design specifies.
 * It was satisfied by a browser-storage adapter in v1.0, and by a database
 * client before this one. Swapping the implementation is still one line in
 * ./index.ts, which is the whole point of keeping the boundary.
 */
export class HttpRepository implements Repository {
  // ---- patients ----
  registerPatient = (input: NewPatient) =>
    call<Patient>('/patients', { method: 'POST', body: input });

  searchPatients = (query: string) =>
    call<Patient[]>('/patients', { query: { q: query } });

  getPatient = (mrn: string) =>
    call<Patient | null>(`/patients/${mrn}`).catch(() => null);

  getPatientChart = (mrn: string) => call<PatientChart>(`/patients/${mrn}/chart`);

  // ---- appointments and queue ----
  listAppointments = (filter: AppointmentFilter = {}) =>
    call<Appointment[]>('/appointments', {
      query: { mrn: filter.mrn, since: filter.since },
    });

  freeSlots = (doctorId: string, date: string) =>
    call<string[]>('/appointments/free-slots', { query: { doctor_id: doctorId, day: date } });

  bookAppointment = (input: NewAppointment) =>
    call<Appointment>('/appointments', { method: 'POST', body: input });

  checkIn = (appointmentId: number) =>
    call<void>(`/appointments/${appointmentId}/check-in`, { method: 'POST' });

  addWalkIn = (mrn: string) =>
    call<void>('/appointments/walk-in', { method: 'POST', query: { mrn } });

  triageQueue = () => call<QueueEntry[]>('/queue/triage');
  doctorQueue = (doctorId: string) =>
    call<QueueEntry[]>('/queue/doctor', { query: { doctor_id: doctorId } });

  // ---- triage and consultation ----
  recordVitals = (input: NewVitals) =>
    call<Vitals>('/vitals', { method: 'POST', body: input });

  signEncounter = (input: SignEncounterInput) =>
    call<void>('/encounters', { method: 'POST', body: input });

  checkPrescriptionSafety = (mrn: string, drug: string) =>
    call<SafetyResult>('/prescriptions/safety', { query: { mrn, drug } });

  // ---- diagnostics ----
  labWorklist = () => call<LabOrder[]>('/lab/worklist');

  advanceLabOrder = (id: number, next: LabStatus, result?: ResultInput) =>
    call<void>(`/lab/${id}/advance`, { method: 'POST', body: { next, ...result } });

  imagingWorklist = () => call<ImagingOrder[]>('/imaging/worklist');

  reportImaging = (id: number, findings: string) =>
    call<void>(`/imaging/${id}/report`, { method: 'POST', body: { findings } });

  // ---- pharmacy ----
  pendingPrescriptions = () => call<Prescription[]>('/pharmacy/prescriptions');
  dispense = (id: number) =>
    call<void>(`/pharmacy/prescriptions/${id}/dispense`, { method: 'POST' });
  inventory = () => call<InventoryItem[]>('/pharmacy/inventory');

  // ---- wards ----
  wardBoard = () => call<Ward[]>('/wards');
  admit = (mrn: string, ward: string, bedNo: string) =>
    call<void>('/wards/admit', { method: 'POST', body: { mrn, ward, bedNo } });
  discharge = (ward: string, bedNo: string) =>
    call<void>('/wards/discharge', { method: 'POST', query: { ward, bed_no: bedNo } });
  medicationRound = () => call<MarEntry[]>('/wards/medication-round');
  recordAdministration = (prescriptionId: number) =>
    call<void>(`/wards/administer/${prescriptionId}`, { method: 'POST' });

  // ---- billing ----
  invoices = () => call<Invoice[]>('/invoices');
  recordPayment = (invoiceId: string, amount: number,
                   method: 'cash' | 'momo', provider?: MomoProvider) =>
    call<void>(`/invoices/${invoiceId}/payment`, {
      method: 'POST', body: { amount, method, provider },
    });
  claims = () => call<Claim[]>('/claims');
  advanceClaim = (claimId: string) =>
    call<void>(`/claims/${claimId}/advance`, { method: 'POST' });

  // ---- admin ----
  dashboardKpis = () => call<Kpis>('/dashboard');
  liveActivity = (limit: number) => call<AuditEntry[]>('/audit', { query: { limit } });
  staffDirectory = () => call<Staff[]>('/staff');

  createStaff = (input: NewStaff) =>
    call<Staff>('/staff', { method: 'POST', body: input });

  updateStaff = (id: string, patch: StaffPatch) =>
    call<void>(`/staff/${id}`, { method: 'PATCH', body: patch });

  resetStaffPassword = (id: string, password: string) =>
    call<void>(`/staff/${id}/password`, { method: 'POST', body: { password } });
  bookableDoctors = () => call<Staff[]>('/staff/bookable');
  hospitalSnapshot = () => call<OpsSnapshot>('/snapshot');

  // ---- notifications ----
  notifications = () => call<AppNotification[]>('/notifications');
  markRead = (id: number) =>
    call<void>(`/notifications/${id}/read`, { method: 'POST' });

  // ---- your own account ----
  notificationPreferences = () =>
    call<NotifyPrefs>('/account/notifications');

  saveNotificationPreferences = (prefs: NotifyPrefs) =>
    call<NotifyPrefs>('/account/notifications', { method: 'PATCH', body: prefs });

  // Unauthenticated, and deliberately incurious: the same answer comes
  // back whether or not the address is registered.
  requestPasswordReset = (email: string) =>
    call<{ message: string }>('/auth/forgot-password', {
      method: 'POST', body: { email },
    });

  changePassword = (currentPassword: string, newPassword: string) =>
    call<void>('/account/password', {
      method: 'POST', body: { currentPassword, newPassword },
    });

  // ---- corrections ----
  correctPatient = (mrn: string, patch: PatientDemographics) =>
    call<Patient>(`/patients/${mrn}`, { method: 'PATCH', body: patch });

  updateClinicalFacts = (mrn: string, patch: ClinicalFacts) =>
    call<Patient>(`/patients/${mrn}/clinical`, { method: 'PATCH', body: patch });

  // ---- catalogues ----
  catalogue = (kind?: CatalogueItem['kind']) =>
    call<CatalogueItem[]>('/catalogue', { query: { kind } });

  addCatalogueItem = (input: NewCatalogueItem) =>
    call<CatalogueItem>('/catalogue', { method: 'POST', body: input });

  updateCatalogueItem = (id: number, patch: Partial<NewCatalogueItem> & { isActive?: boolean }) =>
    call<CatalogueItem>(`/catalogue/${id}`, { method: 'PATCH', body: patch });

  departments = () => call<string[]>('/catalogue/departments');

  addDepartment = (name: string) =>
    call<{ name: string }>('/catalogue/departments', { method: 'POST', query: { name } });

  // ---- stock ----
  addInventoryItem = (input: NewInventoryItem) =>
    call<InventoryItem>('/pharmacy/inventory', { method: 'POST', body: input });

  updateInventoryItem = (id: number, patch: InventoryPatch) =>
    call<InventoryItem>(`/pharmacy/inventory/${id}`, { method: 'PATCH', body: patch });

  moveStock = (id: number, quantity: number, reason: string) =>
    call<{ quantity: number }>(`/pharmacy/inventory/${id}/movement`, {
      method: 'POST', body: { quantity, reason },
    });

  stockMovements = (id: number) =>
    call<StockMovement[]>(`/pharmacy/inventory/${id}/movements`);

  discontinuePrescription = (id: number, reason: string) =>
    call<void>(`/pharmacy/prescriptions/${id}/discontinue`, {
      method: 'POST', body: { reason },
    });

  // ---- wards ----
  addWard = (name: string) =>
    call<{ name: string }>('/wards/wards', { method: 'POST', body: { name } });

  addBed = (ward: string, bedNo: string) =>
    call<Bed>('/wards/beds', { method: 'POST', body: { ward, bedNo } });

  setBedAvailability = (ward: string, bedNo: string, isAvailable: boolean, reason?: string) =>
    call<Bed>(`/wards/beds/${encodeURIComponent(ward)}/${encodeURIComponent(bedNo)}`, {
      method: 'PATCH', body: { isAvailable, reason },
    });

  transferBed = (mrn: string, ward: string, bedNo: string) =>
    call<void>('/wards/transfer', { method: 'POST', body: { mrn, ward, bedNo } });

  // ---- rosters and the appointment lifecycle ----
  roster = (doctorId: string) => call<Roster>(`/rosters/${doctorId}`);

  addShift = (shift: Omit<Shift, 'id' | 'dayName'>) =>
    call<Shift>('/rosters/shifts', { method: 'POST', body: shift });

  removeShift = (id: number) =>
    call<void>(`/rosters/shifts/${id}`, { method: 'DELETE' });

  bookLeave = (doctorId: string, startsOn: string, endsOn: string, reason?: string) =>
    call<LeaveEntry>('/rosters/leave', {
      method: 'POST', body: { doctorId, startsOn, endsOn, reason },
    });

  cancelLeave = (id: number) => call<void>(`/rosters/leave/${id}`, { method: 'DELETE' });

  cancelAppointment = (id: number, reason: string) =>
    call<void>(`/appointments/${id}/cancel`, { method: 'POST', body: { reason } });

  rescheduleAppointment = (id: number, apptDate: string, apptTime: string) =>
    call<Appointment>(`/appointments/${id}/reschedule`, {
      method: 'POST', body: { apptDate, apptTime },
    });

  markDidNotAttend = (id: number) =>
    call<void>(`/appointments/${id}/did-not-attend`, { method: 'POST' });

  // ---- clinical corrections ----
  fileDocument = (input: { mrn: string; title: string; kind: string; body: string }) =>
    call<ClinicalDocument>('/documents', { method: 'POST', body: input });

  addAddendum = (encounterId: number, body: string) =>
    call<void>(`/encounters/${encounterId}/addendum`, { method: 'POST', body: { body } });

  correctVitals = (id: number, patch: Record<string, unknown>) =>
    call<Vitals>(`/vitals/${id}/correct`, { method: 'POST', body: patch });

  cancelLabOrder = (id: number, reason: string) =>
    call<void>(`/lab/${id}/cancel`, { method: 'POST', body: { reason } });

  rejectSample = (id: number, reason: string) =>
    call<void>(`/lab/${id}/reject`, { method: 'POST', body: { reason } });

  advanceImaging = (id: number, next: 'scheduled' | 'scanned') =>
    call<void>(`/imaging/${id}/advance`, { method: 'POST', query: { next } });

  reprioritise = (mrn: string, acuity: Acuity, reason: string) =>
    call<void>(`/queue/${mrn}/acuity`, { method: 'POST', body: { acuity, reason } });

  // ---- money ----
  addInvoiceLine = (invoiceId: string, description: string, amount: number) =>
    call<void>(`/invoices/${invoiceId}/line`, { method: 'POST', body: { description, amount } });

  refund = (invoiceId: string, amount: number, reason: string) =>
    call<void>(`/invoices/${invoiceId}/refund`, { method: 'POST', body: { amount, reason } });

  writeOff = (invoiceId: string, amount: number, reason: string) =>
    call<void>(`/invoices/${invoiceId}/write-off`, { method: 'POST', body: { amount, reason } });

  paymentHistory = (invoiceId: string) =>
    call<PaymentEntry[]>(`/invoices/${invoiceId}/payments`);

  raiseClaim = (invoiceId: string, insurer: string, amount: number) =>
    call<Claim>('/claims', { method: 'POST', body: { invoiceId, insurer, amount } });

  rejectClaim = (claimId: string, reason: string) =>
    call<void>(`/claims/${claimId}/reject`, { method: 'POST', body: { reason } });

  // ---- accounts and operations ----
  grantPortalAccess = (mrn: string, access: PortalAccess) =>
    call<{ email: string }>(`/patients/${mrn}/portal-access`, {
      method: 'POST', body: access,
    });

  sendMessage = (message: StaffMessage) =>
    call<void>('/notifications', { method: 'POST', body: message });

  summary = (days = 7) => call<Summary>('/reports/summary', { query: { days } });

  // ---- printable documents ----
  // A missing or out-of-scope document becomes null so the page can call
  // notFound(); the API deliberately answers 403 and 404 alike, so that
  // asking cannot be used to discover which documents exist.
  prescriptionSlip = (id: number) =>
    call<PrescriptionSlip>(`/documents/prescription/${id}`).catch(() => null);

  receipt = (invoiceId: string) =>
    call<ReceiptDocument>(`/documents/receipt/${invoiceId}`).catch(() => null);

  dischargeSummary = (id: number) =>
    call<DischargeSummary>(`/documents/discharge/${id}`).catch(() => null);
}
