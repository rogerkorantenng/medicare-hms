import type { Role } from '@/lib/repository/types';

/** The eight staff roles. A patient account is not created here. */
export const STAFF_ROLES: Role[] = ['doctor', 'nurse', 'receptionist', 'lab',
  'radiology', 'pharmacist', 'cashier', 'admin'];

/** Free text in the database; a list here so spelling stays consistent. */
export const DEPARTMENTS = ['Cardiology', 'Neurology', 'Dermatology',
  'Orthopaedics', 'General Medicine', 'Outpatient', 'Front Desk', 'Laboratory',
  'Radiology', 'Pharmacy', 'Accounts', 'Administration', 'Maternity',
  'Paediatrics'];
