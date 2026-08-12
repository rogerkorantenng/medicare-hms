'use server';

import { revalidatePath } from 'next/cache';
import { repo } from '@/lib/repository';
import type {
  NewPatient, NewAppointment, NewVitals, SignEncounterInput, LabStatus,
  ResultInput, MomoProvider, NewStaff, StaffPatch, PatientDemographics, ClinicalFacts, NotifyPrefs, NewInventoryItem,
  InventoryPatch, NewCatalogueItem, Shift, StaffMessage, Acuity,
} from '@/lib/repository/types';

/**
 * Server actions. Every one of these runs on the server with the caller's
 * session, so row-level security applies to the write exactly as it would to
 * a read. Nothing here re-checks the role: the database is the authority, and
 * a second copy of the rules in TypeScript would only be a place for the two
 * to drift apart.
 *
 * The shape is deliberately uniform — { ok, message } — so every screen can
 * raise a toast the same way.
 */
export type ActionResult = { ok: true; message: string; data?: unknown }
                         | { ok: false; message: string };

async function run<T>(fn: () => Promise<T>, success: string, paths: string[] = []): Promise<ActionResult> {
  try {
    const data = await fn();
    paths.forEach((p) => revalidatePath(p));
    return { ok: true, message: success, data };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'That did not work.' };
  }
}

// ---- reception ----

export const registerPatientAction = (input: NewPatient) =>
  run(() => repo.registerPatient(input), 'Patient registered.', ['/workspace/receptionist', '/workspace/patients']);

export const checkInAction = (id: number) =>
  run(() => repo.checkIn(id), 'Checked in. Now in the triage queue.', ['/workspace/receptionist', '/workspace/nurse']);

export const walkInAction = (mrn: string) =>
  run(() => repo.addWalkIn(mrn), 'Walk-in added to the queue.', ['/workspace/receptionist', '/workspace/nurse']);

export const bookAppointmentAction = (input: NewAppointment) =>
  run(() => repo.bookAppointment(input), 'Appointment booked.', ['/workspace/receptionist/appointments']);

export const freeSlotsAction = async (doctorId: string, date: string) => {
  try {
    return { ok: true as const, slots: await repo.freeSlots(doctorId, date) };
  } catch {
    return { ok: false as const, slots: [] as string[] };
  }
};

// ---- nurse ----

export const recordVitalsAction = (input: NewVitals) =>
  run(() => repo.recordVitals(input), 'Vitals recorded.', ['/workspace/nurse', '/workspace/doctor']);

export const admitAction = (mrn: string, ward: string, bedNo: string) =>
  run(() => repo.admit(mrn, ward, bedNo), 'Patient admitted.', ['/workspace/nurse/wards']);

export const dischargeAction = (ward: string, bedNo: string) =>
  run(() => repo.discharge(ward, bedNo), 'Discharged. Bed freed and summary written.', ['/workspace/nurse/wards']);

export const administerAction = (rxId: number) =>
  run(() => repo.recordAdministration(rxId), 'Administration recorded.', ['/workspace/nurse/mar']);

// ---- doctor ----

export const signEncounterAction = (input: SignEncounterInput) =>
  run(() => repo.signEncounter(input), 'Consultation signed. Orders dispatched.',
      ['/workspace/doctor', '/workspace/lab', '/workspace/radiology', '/workspace/pharmacist']);

export const checkSafetyAction = async (mrn: string, drug: string) => {
  try {
    return await repo.checkPrescriptionSafety(mrn, drug);
  } catch {
    // A failed check must not read as a pass.
    return { ok: false as const, kind: 'interaction' as const,
             message: 'The safety check could not be completed. Do not prescribe until it can.' };
  }
};

// ---- laboratory and radiology ----

export const advanceLabAction = (id: number, next: LabStatus, result?: ResultInput) =>
  run(() => repo.advanceLabOrder(id, next, result),
      next === 'verified' ? 'Verified and released.' : `Marked ${next}.`,
      ['/workspace/lab', '/workspace/doctor']);

export const reportImagingAction = (id: number, findings: string) =>
  run(() => repo.reportImaging(id, findings), 'Report filed.', ['/workspace/radiology']);

// ---- pharmacy ----

export const dispenseAction = (id: number) =>
  run(() => repo.dispense(id), 'Dispensed. Stock decremented and charge captured.',
      ['/workspace/pharmacist', '/workspace/pharmacist/inventory', '/workspace/cashier']);

// ---- billing ----

export const recordPaymentAction = (
  invoiceId: string, amount: number, method: 'cash' | 'momo', provider?: MomoProvider,
) => run(() => repo.recordPayment(invoiceId, amount, method, provider), 'Payment recorded.', ['/workspace/cashier']);

export const advanceClaimAction = (claimId: string) =>
  run(() => repo.advanceClaim(claimId), 'Claim advanced.', ['/workspace/cashier/claims']);

// ---- staff administration ----
// Creating an account is the one action that hands somebody clinical
// access, so the API guards it to an administrator and re-checks the role
// from the database rather than the token. Nothing is re-checked here: a
// second copy of the rule in TypeScript would only be a place for the two
// to drift apart.

export const createStaffAction = (input: NewStaff) =>
  run(() => repo.createStaff(input), 'Staff account created.', ['/workspace/admin/staff']);

export const updateStaffAction = (id: string, patch: StaffPatch) =>
  run(() => repo.updateStaff(id, patch), 'Staff record updated.',
      ['/workspace/admin/staff', '/workspace/admin']);

export const resetStaffPasswordAction = (id: string, password: string) =>
  run(() => repo.resetStaffPassword(id, password), 'Password reset. Hand it over in person.',
      ['/workspace/admin/staff']);

// ---- your own account, and corrections ----

export const changePasswordAction = (currentPassword: string, newPassword: string) =>
  run(() => repo.changePassword(currentPassword, newPassword), 'Password changed.');

export const correctPatientAction = (mrn: string, patch: PatientDemographics) =>
  run(() => repo.correctPatient(mrn, patch), 'Details corrected.',
      ['/workspace/patients', `/workspace/patients/${mrn}`]);

// Recording an allergy is what makes the prescribing guard fire for it, so
// the consultation screen is revalidated too.
export const updateClinicalFactsAction = (mrn: string, patch: ClinicalFacts) =>
  run(() => repo.updateClinicalFacts(mrn, patch), 'Clinical record updated.',
      [`/workspace/patients/${mrn}`, `/workspace/doctor/consultation/${mrn}`]);

export const saveNotifyPrefsAction = (prefs: NotifyPrefs) =>
  run(() => repo.saveNotificationPreferences(prefs), 'Preferences saved.', ['/app/profile']);

// ---------------------------------------------------------------------
// Operations. Everything below closes a gap where the system could show
// you something and not let you change it.
// ---------------------------------------------------------------------

// ---- stock ----
export const addInventoryItemAction = (input: NewInventoryItem) =>
  run(() => repo.addInventoryItem(input), 'Item added to inventory.',
      ['/workspace/pharmacist/inventory']);

export const updateInventoryItemAction = (id: number, patch: InventoryPatch) =>
  run(() => repo.updateInventoryItem(id, patch), 'Item updated.',
      ['/workspace/pharmacist/inventory']);

export const moveStockAction = (id: number, quantity: number, reason: string) =>
  run(() => repo.moveStock(id, quantity, reason),
      quantity > 0 ? 'Stock received.' : 'Stock adjusted.',
      ['/workspace/pharmacist/inventory', '/workspace/pharmacist']);

export const discontinueAction = (id: number, reason: string) =>
  run(() => repo.discontinuePrescription(id, reason), 'Prescription discontinued.',
      ['/workspace/pharmacist', '/workspace/doctor']);

// ---- catalogues ----
export const addCatalogueItemAction = (input: NewCatalogueItem) =>
  run(() => repo.addCatalogueItem(input), 'Added to the catalogue.',
      ['/workspace/admin/catalogue']);

export const updateCatalogueItemAction = (
  id: number, patch: Partial<NewCatalogueItem> & { isActive?: boolean },
) => run(() => repo.updateCatalogueItem(id, patch), 'Catalogue updated.',
        ['/workspace/admin/catalogue']);

// ---- wards ----
export const addWardAction = (name: string) =>
  run(() => repo.addWard(name), 'Ward opened.', ['/workspace/nurse/wards']);

export const addBedAction = (ward: string, bedNo: string) =>
  run(() => repo.addBed(ward, bedNo), 'Bed added.', ['/workspace/nurse/wards']);

export const setBedAvailabilityAction = (
  ward: string, bedNo: string, isAvailable: boolean, reason?: string,
) => run(() => repo.setBedAvailability(ward, bedNo, isAvailable, reason),
        isAvailable ? 'Bed back in service.' : 'Bed taken out of service.',
        ['/workspace/nurse/wards']);

export const transferBedAction = (mrn: string, ward: string, bedNo: string) =>
  run(() => repo.transferBed(mrn, ward, bedNo), 'Patient transferred.',
      ['/workspace/nurse/wards']);

// ---- rosters and appointments ----
export const addShiftAction = (shift: Omit<Shift, 'id' | 'dayName'>) =>
  run(() => repo.addShift(shift), 'Clinic added.', ['/workspace/admin/rosters']);

export const removeShiftAction = (id: number) =>
  run(() => repo.removeShift(id), 'Clinic removed.', ['/workspace/admin/rosters']);

export const bookLeaveAction = (
  doctorId: string, startsOn: string, endsOn: string, reason?: string,
) => run(() => repo.bookLeave(doctorId, startsOn, endsOn, reason), 'Leave booked.',
        ['/workspace/admin/rosters']);

export const cancelLeaveAction = (id: number) =>
  run(() => repo.cancelLeave(id), 'Leave removed.', ['/workspace/admin/rosters']);

const APPOINTMENT_PATHS = ['/workspace/receptionist',
                           '/workspace/receptionist/appointments', '/app'];

export const cancelAppointmentAction = (id: number, reason: string) =>
  run(() => repo.cancelAppointment(id, reason), 'Appointment cancelled.', APPOINTMENT_PATHS);

export const rescheduleAction = (id: number, apptDate: string, apptTime: string) =>
  run(() => repo.rescheduleAppointment(id, apptDate, apptTime), 'Appointment moved.',
      APPOINTMENT_PATHS);

export const didNotAttendAction = (id: number) =>
  run(() => repo.markDidNotAttend(id), 'Recorded as did not attend.', APPOINTMENT_PATHS);

// ---- clinical corrections ----
export const fileDocumentAction = (
  input: { mrn: string; title: string; kind: string; body: string },
) => run(() => repo.fileDocument(input), 'Document filed.',
        [`/workspace/patients/${input.mrn}`]);

export const addAddendumAction = (encounterId: number, mrn: string, body: string) =>
  run(() => repo.addAddendum(encounterId, body), 'Addendum added.',
      [`/workspace/patients/${mrn}`]);

export const correctVitalsAction = (id: number, mrn: string, patch: Record<string, unknown>) =>
  run(() => repo.correctVitals(id, patch), 'Reading corrected.',
      [`/workspace/patients/${mrn}`, '/workspace/nurse']);

export const cancelLabAction = (id: number, reason: string) =>
  run(() => repo.cancelLabOrder(id, reason), 'Order cancelled.',
      ['/workspace/lab', '/workspace/doctor/orders']);

export const rejectSampleAction = (id: number, reason: string) =>
  run(() => repo.rejectSample(id, reason), 'Sample rejected. A fresh one is needed.',
      ['/workspace/lab']);

export const advanceImagingAction = (id: number, next: 'scheduled' | 'scanned') =>
  run(() => repo.advanceImaging(id, next), `Marked ${next}.`, ['/workspace/radiology']);

export const reprioritiseAction = (mrn: string, acuity: Acuity, reason: string) =>
  run(() => repo.reprioritise(mrn, acuity, reason), 'Queue position updated.',
      ['/workspace/nurse', '/workspace/doctor']);

// ---- money ----
const BILLING_PATHS = ['/workspace/cashier', '/workspace/cashier/claims'];

export const addInvoiceLineAction = (invoiceId: string, description: string, amount: number) =>
  run(() => repo.addInvoiceLine(invoiceId, description, amount), 'Charge added.', BILLING_PATHS);

export const refundAction = (invoiceId: string, amount: number, reason: string) =>
  run(() => repo.refund(invoiceId, amount, reason), 'Refund recorded.', BILLING_PATHS);

export const writeOffAction = (invoiceId: string, amount: number, reason: string) =>
  run(() => repo.writeOff(invoiceId, amount, reason), 'Balance written off.', BILLING_PATHS);

export const raiseClaimAction = (invoiceId: string, insurer: string, amount: number) =>
  run(() => repo.raiseClaim(invoiceId, insurer, amount), 'Claim raised.', BILLING_PATHS);

export const rejectClaimAction = (claimId: string, reason: string) =>
  run(() => repo.rejectClaim(claimId, reason), 'Rejection recorded.', BILLING_PATHS);

// ---- accounts and messages ----
export const grantPortalAccessAction = (mrn: string, email: string, password: string) =>
  run(() => repo.grantPortalAccess(mrn, { email, password }),
      'Account created. Give them the password in person.',
      [`/workspace/patients/${mrn}`]);

export const sendMessageAction = (message: StaffMessage) =>
  run(() => repo.sendMessage(message), 'Message sent.');
