'use server';

import { revalidatePath } from 'next/cache';
import { repo } from '@/lib/repository';
import type {
  NewPatient, NewAppointment, NewVitals, SignEncounterInput, LabStatus,
  ResultInput, MomoProvider, NewStaff, StaffPatch,
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
